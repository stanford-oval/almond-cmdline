// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2016-2017 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const Q = require('q');
Q.longStackSupport = true;

const uuid = require('uuid');
const fs = require('fs');
const path = require('path');
const events = require('events');
const readline = require('readline');
const ThingTalk = require('thingtalk');

const Config = require('../config');

const Engine = require('thingengine-core');

const logfile = fs.createWriteStream(process.argv[2]);

class ApiConversation extends events.EventEmitter {
    constructor(engine) {
        super();

        this._gettext = engine.platform.getCapability('gettext');
        this._engine = engine;
        this._engineId = engine.__engineId;
    }

    notify(appId, icon, outputType, outputValue, currentChannel) {
        logfile.write(`${Date.now()}\tnotify\t${this._engineId} ${appId} ${icon} ${outputType} ${JSON.stringify(outputValue)}\n`);
        this.emit('notify', appId, icon, outputType, outputValue, currentChannel);
    }

    notifyError(appId, icon, error) {
        logfile.write(`${Date.now()}\terror\t${this._engineId} ${appId} ${icon} ${error}\n`);
        this.emit('notify-error', appId, icon, error);
    }

    runProgram(program, uniqueId) {
        console.log('Adding program ' + uniqueId + ' to engine ' + this._engineId);
        logfile.write(`${Date.now()}\trun-program\t${this._engineId} ${uniqueId}\n`);

        let name = ThingTalk.Describe.getProgramName(this._gettext, program);
        let description = ThingTalk.Describe.describeProgram(this._gettext, program);

        let appMeta = {};
        let code = ThingTalk.Ast.prettyprint(program);

        return this._engine.apps.loadOneApp(code, appMeta, uniqueId, undefined,
                                            name, description, true).then((app) => {
            if (!app)
                return;
            this.emit('program-loaded', app.uniqueId);
        });
    }
}

class MockAssistant {
    constructor(engine) {
        this._conversation = new ApiConversation(engine);
    }

    getConversation() {
        return this._conversation;
    }
    notifyAll(...data) {
        return this._conversation.notify(...data);
    }
    notifyErrorAll(...data) {
        return this._conversation.notifyErrorAll(...data);
    }
}

const TEST_CASES = [];

function test(testCase, i) {
    console.log('Test Case #' + (i+1));
}

function promiseLoop(array, fn) {
    let results = [];
    return (function loop(i) {
        if (i === array.length)
            return Q(results);

        return Q(fn(array[i], i)).then((res) => {
            results.push(res);
            return loop(i+1);
        });
    })(0);
}

function initUser(i) {
    let homedir = './home-' + i;
    console.log('Initializing user ' + i);

    let platform = require('../platform').newInstance(homedir);
    let engine = new Engine(platform, { thingpediaUrl: process.env.THINGPEDIA_URL || Config.THINGPEDIA_URL });
    engine.__engineId = i;

    engine.messaging.on('incoming-message', (feedId, obj, event) => {
        let length = JSON.stringify(event.getWireContent()).length;
        logfile.write(`${Date.now()}\tincoming-message\t${engine.__engineId} ${length} ${obj.msgId} ${JSON.stringify(event.getContent())}\n`);
    });
    engine.messaging.on('outgoing-message', (feedId, obj, event) => {
        let length = JSON.stringify(event.getWireContent()).length;
        logfile.write(`${Date.now()}\toutgoing-message\t${engine.__engineId} ${length} ${obj.msgId} ${JSON.stringify(event.getContent())}\n`);
    });
    // override permission check to allow
    engine.permissions._isAllowedProgram = (principal, identity, program) => Q(program);

    let assistant = new MockAssistant(engine);
    platform.setAssistant(assistant);

    return engine.open().then(() => engine);
}

function repeat(n, delay, fn) {
    return (function loop(i) {
        if (i === n)
            return Q();

        return Q(fn(i)).delay(delay).then(() => loop(i+1));
    })(0);
}

function genData(size) {
    return String(Buffer.alloc(size, 'A'));
}

const INSTALL_LATENCY_TESTS = [
    0, 100, 400, 1000, 1800
]

function installLatencyTest(engine1, engine2, sz) {
    let prog = ThingTalk.Grammar.parse(`now => @org.thingpedia.builtin.test.eat_data(data="");`);
    prog.rules[0].actions[0].in_params[0].value.value = genData(sz);
    let code = ThingTalk.Ast.prettyprint(prog, true).trim();

    return repeat(3, 10000, (i) => {
        let uniqueId = uuid.v4();

        console.log(`Latency test begin, size ${code.length}, iteration ${i+1}`);
        logfile.write(`${Date.now()}\ttest-begin\tlatency ${code.length} ${i+1}/3\n`);
        return Q.Promise((resolve, reject) => {

            let added = (newId) => {
                if (newId !== uniqueId)
                    return;
                conversation.removeListener('program-loaded', added);
                resolve();
            }
            let assistant = engine2.platform.getCapability('assistant');
            let conversation = assistant.getConversation();
            conversation.on('program-loaded', added);

            engine1.remote.installProgramRemote(engine2.messaging.account, '', uniqueId, prog).catch(reject);
        }).then(() => {
            logfile.write(`${Date.now()}\ttest-end\tlatency ${code.length} ${i+1}/3\n`);
        });
    });
}

const ROUND_TRIP_TIME_TEST = [
    10, 50, 100, 200, 400, 800, 1600, 3200
]

function roundTripTimeTest(engine1, engine2, sz) {
    if (engine1.__engineId === engine2.__engineId)
        throw new Error();
    if (engine1.platform === engine2.platform)
        throw new Error();

    return repeat(3, 20000, (i) => {
        return ThingTalk.Grammar.parseAndTypecheck(`now => @org.thingpedia.builtin.test.get_data(count=1,size=1byte), v_data := data => return;`, engine1.schemas).then((prog) => {
            prog.principal = ThingTalk.Ast.Value.Entity(engine2.messaging.type + '-account:' + engine2.messaging.account, 'tt:contact', null);
            for (let param of prog.rules[0].queries[0].in_params) {
                if (param.name === 'size') {
                    param.value.value = sz;
                    break;
                }
            }
            let [engine1prog] = ThingTalk.Generate.lowerReturn(engine1.messaging, prog);
            prog.principal = null;
            let uniqueId = uuid.v4();

            console.log(`RTT test begin, size ${sz}, iteration ${i+1}`);
            logfile.write(`${Date.now()}\ttest-begin\trtt ${sz} ${i+1}/3\n`);
            return Q.Promise((resolve, reject) => {

                let added = (newId) => {
                    if (newId !== uniqueId)
                        return;
                    conversation.removeListener('notify', added);
                    resolve();
                }
                let assistant = engine1.platform.getCapability('assistant');
                let conversation = assistant.getConversation();
                conversation.on('notify', added);

                setTimeout(() => {
                    reject(new Error('Timed out'));
                }, 60000);

                conversation.runProgram(engine1prog, uniqueId).then(() => {
                    return engine1.remote.installProgramRemote(engine2.messaging.account, '', uniqueId, prog);
                }).catch(reject);
            }).then(() => {
                logfile.write(`${Date.now()}\ttest-end\trtt ${sz} ${i+1}/3\n`);
            });
        });
    });
}

function main() {
    promiseLoop([1,2], initUser).then(([engine1, engine2]) => {
        console.log('Initialized, starting test');
        logfile.write(`${Date.now()}\tbegin\n`);

        return Q.try(() => {
            return promiseLoop(INSTALL_LATENCY_TESTS, (test) => installLatencyTest(engine1, engine2, test));
        }).then(() => {
            return promiseLoop(ROUND_TRIP_TIME_TEST, (test) => roundTripTimeTest(engine1, engine2, test));
        }).then(() => {
            console.log('Test complete');
            logfile.write(`${Date.now()}\tend\n`);

            return Q.all([engine1.close(), engine2.close()]);
        });
    }).then(() => {
        logfile.end();
    }).done();

    logfile.on('finish', () => process.exit());
}
main();
