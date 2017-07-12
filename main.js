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

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const Engine = require('thingengine-core');
const AssistantDispatcher = require('./assistant');

function main() {
    let platform = require('./platform');
    platform.init();

    let engine = new Engine(platform);

    let _ad = new AssistantDispatcher(engine);
    platform.setAssistant(_ad);

    Q.try(function() {
        return engine.open();
    }).then(function() {
        return _ad.interact();
    }).done();
}

main();
