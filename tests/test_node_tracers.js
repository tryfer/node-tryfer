// Copyright 2012 Rackspace Hosting, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var trace = require('..').trace;
var node_tracers = require('..').node_tracers;

var express = require('express');
var http = require('http');
var util = require('util');

var mockKeystoneClient = {
  getTenantIdAndToken: function(options, cb) {
    cb(null, {'token': '1', 'expires': 2, 'tenantId': '3'});
  }
};

// Asserts (via a nodeunit test object) that the result is a base64 string
var assert_is_base64 = function(test, string) {
  test.ok(string.search(/^([A-Za-z0-9+\/]{4})*([A-Za-z0-9+\/]{4}|[A-Za-z0-9+\/]{3}=|[A-Za-z0-9+\/]{2}==)$/) >= 0);
};

// Asserts (via a nodeunit test object) that the result is a json array - if
// it is a string representing a json array, parses the string
var assert_is_json_array = function(test, json) {
  if (typeof json === typeof "") {
    json = JSON.parse(json);
  }
  test.ok(util.isArray(json));
  test.ok(json.length >= 1);
};

// A fake scribe client for testing purposes - rather than send data to scribe,
// it saves the category and message sent to it and allows assertions to be
// made on the data (via a nodeunit test object)
var FakeScribe = function(test) {
  var self = this;
  self.test = test;
  self.results = [];
  self.send = function(category, message) {
    self.results.push([category, message]);
  };
  self.assert_sent = function() {
    self.test.equal(self.results.length, 1);
    self.test.equal(self.results[0].length, 2);
  };
  self.assert_category = function(category) {
    self.test.equal(self.results[0][0], category);
  };
  self.assert_json = function() {
    assert_is_json_array(self.test, self.results[0][1]);
  };
  self.assert_base64 = function() {
    assert_is_base64(self.test, self.results[0][1]);
  };
};


module.exports = {
  setUp: function(cb) {
    this.trace = new trace.Trace('clientRecv');
    this.annotation = trace.Annotation.clientRecv(2);
    this.traces = [[this.trace, [this.annotation]]];
    cb();
  },

  test_raw_restkin_tracer: function(test){
    var self = this;
    var app = express();
    var server = http.createServer(app);
    var tracer1, tracer2;
    var i = 0;

    app.use(express.bodyParser());

    app.post('/3/trace', function(request, response) {
      i++;
      test.equal(request.headers['x-auth-token'], '1');
      test.equal(request.headers['x-tenant-id'], '3');
      test.equal(request.headers['content-type'], 'application/json');
      test.notEqual(request.headers['content-length'], '0');

      assert_is_json_array(test, request.body);
      test.equal(request.body.length, 1);

      response.end('done');

      if (i === 2) {
        server.close();
      }
    });

    server.on('close', function(){
      test.done();
    });

    server.listen(22222, 'localhost');

    // Valid URL
    tracer1 = new node_tracers.RawRESTkinHTTPTracer('http://localhost:22222',
                                             mockKeystoneClient);

    // Valid URL with trailing slash
    tracer2 = new node_tracers.RawRESTkinHTTPTracer('http://localhost:22222/',
                                             mockKeystoneClient);

    tracer1.record(self.traces);
    tracer2.record(self.traces);
  },

  test_raw_restkin_tracer_server_connection_to_server_refused: function(test) {
    var tracer;

    tracer = new node_tracers.RawRESTkinHTTPTracer('http://localhost:1898/',
                                            mockKeystoneClient);

    tracer.record(this.traces);
    test.done();
  },

  test_restkin_tracer_maxTraces: function(test) {
    var self = this;
    var app = express();
    var server = http.createServer(app);
    var tracer;
    var options;

    app.use(express.bodyParser());

    app.post('/3/trace', function(request, response) {
      var body = request.body;

      test.equal(request.headers['x-auth-token'], '1');
      test.equal(request.headers['x-tenant-id'], '3');
      test.equal(request.headers['content-type'], 'application/json');
      test.notEqual(request.headers['content-length'], '0');

      assert_is_json_array(test, body);
      test.equal(body.length, 15);

      response.end('done');
      tracer.stop();
      server.close();
    });

    server.on('close', function(){
      test.done();
    });

    server.listen(22222, 'localhost');

    options = {'maxTraces': 15};
    tracer = new node_tracers.RESTkinHTTPTracer('http://localhost:22222',
                                            mockKeystoneClient, options);

    for (i = 0; i < 15; i++) {
      tracer.record(this.traces);
    }
  },

  test_restkin_tracer_sendInterval: function(test) {
    var self = this;
    var app = express();
    var server = http.createServer(app);
    var tracer;
    var options;
    var now = Date.now();

    app.use(express.bodyParser());

    app.post('/3/trace', function(request, response) {
      var body = request.body;

      test.equal(request.headers['x-auth-token'], '1');
      test.equal(request.headers['x-tenant-id'], '3');
      test.equal(request.headers['content-type'], 'application/json');
      test.notEqual(request.headers['content-length'], '0');

      assert_is_json_array(test, body);
      test.equal(body.length, 2);
      test.ok(now + 1000 <= Date.now());

      response.end('done');
      server.close();
      tracer.stop();
    });

    server.on('close', function(){
      test.done();
    });

    server.listen(22222, 'localhost');

    options = {'sendInterval': 1};
    tracer = new node_tracers.RESTkinHTTPTracer('http://localhost:22222',
                                                mockKeystoneClient, options);

    tracer.record(this.traces);
    tracer.record(this.traces);
  },

  test_zipkin_tracer_default_category: function(test){
    var s = new FakeScribe(test);
    var t = new node_tracers.RawZipkinTracer(s);
    t.record(this.traces);

    setTimeout(function() {
      s.assert_sent();
      s.assert_category('zipkin');
      s.assert_base64();
      test.done();
    }, 100);
  },

  test_zipkin_tracer_provided_category: function(test){
    var s = new FakeScribe(test);
    var t = new node_tracers.RawZipkinTracer(s, 'mycategory');
    t.record(this.traces);

    setTimeout(function() {
      s.assert_sent();
      s.assert_category('mycategory');
      s.assert_base64();
      test.done();
    }, 100);
  },

  test_restkin_scribe_tracer_default_category: function(test){
    var s = new FakeScribe(test);
    var t = new node_tracers.RawRESTkinScribeTracer(s);
    t.record(this.traces);

    setTimeout(function() {
      s.assert_sent();
      s.assert_category('restkin');
      s.assert_json();
      test.done();
    }, 100);
  },

  test_restkin_scribe_tracer_provided_category: function(test){
    var s = new FakeScribe(test);
    var t = new node_tracers.RawRESTkinScribeTracer(s, 'mycategory');
    t.record(this.traces);

    setTimeout(function() {
      s.assert_sent();
      s.assert_category('mycategory');
      s.assert_json();
      test.done();
    }, 100);
  }
};
