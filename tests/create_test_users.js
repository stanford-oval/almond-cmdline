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
    const delegate = {
        reply(msg) {
            console.log('>> ' + reply);
        },
        confirm(question) {
            console.log('>? ' + question);
            return Q(true);
        },
        requestCode(question) {
            console.log('>= ' + question);

            switch (question) {
            case "Insert your email address or phone number:":
                return Q(`testuser${i}@${TEST_HOMESERVER}`);
            case "Insert your password:":
                return Q(`testuser${i}`);
            default:
                throw new Error('Unexpected question');
            }
        }
    };

    let homedir = './home-testuser' + i;
    console.log('Initializing user ' + i);

    let platform = require('../platform').newInstance(homedir);
    let engine = new Engine(platform, { thingpediaUrl: process.env.THINGPEDIA_URL || Config.THINGPEDIA_URL });
    engine.__engineId = i;

    return engine.open().then(() => {
        return engine.devices.factory.getFactory('org.thingpedia.builtin.matrix');
    }).then((factory) => {
        return factory.configureFromAlmond(engine, delegate);
    }).then((device) => {
        return Q.delay(2000);
    }).then((device) => {
        console.log('ok! Configured user ' + i);
        return engine.close();
    });
}

function promiseLoop(begin, end, fn) {
    return (function loop(i) {
        if (i === end)
            return Q();

        return Q(fn(i)).then(() => {
            return loop(i+1);
        });
    })(begin);
}

function main() {
    promiseLoop(1, 11, initUser).then(() => process.exit()).done();
}
main();
