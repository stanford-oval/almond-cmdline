// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2016-2017 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
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

const TEST_HOMESERVER = 'camembert.stanford.edu';

process.env.MATRIX_IDENTITY_SERVER_URL = `http://${TEST_HOMESERVER}:8090`;
process.env.MATRIX_HOMESERVER_URL = `http://${TEST_HOMESERVER}:8008`;

function initUser(i) {
    let homedir = './home-testuser' + i;
    console.log('Initializing user ' + i);

    let platform = require('../platform').newInstance(homedir);
    let engine = new Engine(platform, { thingpediaUrl: process.env.THINGPEDIA_URL || Config.THINGPEDIA_URL });
    engine.__engineId = i;

    return engine.open().then(() => engine);
}

function promiseLoop(begin, end, fn) {
    let results = [];
    return (function loop(i) {
        if (i === end)
            return Q(results);

        return Q(fn(i)).then((res) => {
            results.push(res);
            return loop(i+1);
        });
    })(begin);
}


function main() {
    let name = process.argv[2];
    if (!name)
        throw new Error('Specify room name in command line');
    let begin = parseInt(process.argv[3]);
    let end = parseInt(process.argv[4]);
    if (!(begin < end))
        throw new Error('Invalid begin/end');

    promiseLoop(1, 11, initUser).then((engines) => {
        let leader = engines[0];
        let followers = [];
        for (let i = begin; i <= end; i++)
            followers.push(`@testuser${i}:${TEST_HOMESERVER}`);

        let messaging = leader.messaging._messagingIface;

        return messaging.client.createRoom({ visibility: 'private', preset: 'private_chat', room_alias_name: name, invite: followers }).then(() => {
            return Q.all(engines.map((e) => e.close()));
        });
    }).then(() => process.exit()).done();
}
main();
