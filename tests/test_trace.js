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

var util = require('util');

var ass = require('nodeunit').assert;
var _ = require("underscore");

var trace = require('..').trace;
var tracers = require('..').tracers;

var MAX_ID = Math.pow(2, 63) -1;

ass.isNum = function(num, message){
  ass.equal(isNaN(num), false,
    util.format("%s is not number like", num));
};


var mockTracer = function(name, id, endpoint){
  var self = this;
  self.name = name;
  self.id = id;
  self.endpoint = endpoint;
  self._calls = {record: []};
  self.record = function(){
    self._calls.record.push(Array.prototype.slice.call(arguments));
  };
};

module.exports = {
  traceTests: {
    setUp: function(cb){
      tracers.setTracers([]);
      cb();
    },
    tearDown: function(cb){
      tracers.setTracers([]);
      cb();
    },
    test_new_trace: function(test){
      var t = new trace.Trace('test_trace');
      test.notEqual(t.traceId, undefined);
      test.isNum(t.traceId);
      test.ok(t.traceId < MAX_ID);

      test.notEqual(t.spanId, undefined);
      test.isNum(t.spanId);
      test.ok(t.spanId < MAX_ID);

      test.equal(t.parentSpanId, undefined);
      test.done();
    },
    test_trace_child: function(test){
      var t = new trace.Trace('test_trace', {traceId: 1, spanId: 1});
      var c = t.child('child_test_trace');
      test.equal(c.traceId, 1);
      test.equal(c.parentSpanId, 1);
      test.done();
    },
    test_record_invokes_tracer: function(test){
      var tracer, t, a;
      tracer = new mockTracer();
      t = new trace.Trace('test_trace', {
        traceId: 1, spanId: 1, tracers: [tracer]
      });
      a = trace.Annotation.clientSend(0);
      t.record(a);
      test.deepEqual(tracer._calls.record[0], [t,a]);
      test.done();
    },
    test_record_sets_annotation_endpoint: function(test){
      var tracer, e, t, a;
      tracer = new mockTracer();
      e = new trace.Endpoint('127.0.0.1', 8080, 'web');
      t = new trace.Trace('test_trace',
        {trace_id: 1, span_id: 1, tracers: [tracer]});
      t.setEndpoint(e);
      a = new trace.Annotation.clientSend(1);
      t.record(a);
      test.deepEqual(tracer._calls.record[0], [t,a]);
      test.deepEqual(a.endpoint, e);
      test.done();
    }
  },
  annotationTests: {
    setUp: function(cb){
      var self = this;
      self.origDate = Date.now;
      Date.now = function() {
        return 1000;
      };
      cb();
    },
    tearDown: function(cb){
      var self = this;
      Date.now = self.origDate;
      cb();
    },
    test_timestamp: function(test) {
      var a = trace.Annotation.timestamp('test');
      test.equal(a.name, 'test');
      test.equal(a.value, 1000000);
      test.equal(a.annotationType, 'timestamp');
      test.done();
    },
    test_client_send: function(test) {
      var a = trace.Annotation.clientSend();
      test.equal(a.value, 1000000);
      test.equal(a.name, 'cs');
      test.equal(a.annotationType, 'timestamp');
      test.done();
    },
    test_client_recv: function(test) {
      var a = trace.Annotation.clientRecv();
      test.equal(a.value, 1000000);
      test.equal(a.name, 'cr');
      test.equal(a.annotationType, 'timestamp');
      test.done();
    },
    test_server_send: function(test) {
      var a = trace.Annotation.serverSend();
      test.equal(a.value, 1000000);
      test.equal(a.name, 'ss');
      test.equal(a.annotationType, 'timestamp');
      test.done();
    },
    test_server_recv: function(test) {
      var a = trace.Annotation.serverRecv();
      test.equal(a.value, 1000000);
      test.equal(a.name, 'sr');
      test.equal(a.annotationType, 'timestamp');
      test.done();
    },
    test_string: function(test) {
      var a = trace.Annotation.string('myname', 'ispie');
      test.equal(a.value, 'ispie');
      test.equal(a.name, 'myname');
      test.equal(a.annotationType, 'string');
      test.done();
    }
  }
};
