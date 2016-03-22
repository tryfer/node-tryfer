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

var trace = require('..').trace;
var tracers = require('..').tracers;
var formatters = require('..').formatters;

var MAX_ID = 'ffffffffffffffff';

ass.isNum = function(num){
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

// a valid trace has a traceId and a spanId that are numbers that are greater
// than or equal to zero and less than the max id
var assert_is_valid_trace = function(test, t) {
  test.notEqual(t.traceId, undefined);
  test.ok(typeof t.traceId === 'string');
  test.ok(t.traceId < MAX_ID);
  test.ok(t.traceId.length === 16);

  test.notEqual(t.spanId, undefined);
	test.ok(typeof t.traceId === 'string');
	test.ok(t.spanId < MAX_ID);
  test.ok(t.spanId.length === 16);
};

// generate an Annotation test
var runAnnotationTest = function(test, ann, name, value, ann_type, duration) {
  test.equal(ann.name, name);
  test.equal(ann.value, value);
  test.equal(ann.annotationType, ann_type);
  test.equal(ann.duration, duration);
  test.done();
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
      test.equal(t.name, 'test_trace');
      test.equal(t.parentSpanId, undefined);
      test.equal(t.debug, undefined);
      assert_is_valid_trace(test, t);
      test.done();
    },
    test_new_trace_debug: function(test){
      var t = new trace.Trace('test_trace', {debug: true});
      test.equal(t.name, 'test_trace');
      test.equal(t.parentSpanId, undefined);
      test.equal(t.debug, true);
      assert_is_valid_trace(test, t);
      test.done();
    },
    test_trace_child: function(test){
      var t = new trace.Trace('test_trace', {traceId: 1, spanId: 1});
      var c = t.child('child_test_trace');
      test.equal(c.traceId, 1);
      test.equal(c.parentSpanId, 1);
      test.equal(c.debug, undefined);
      test.done();
    },
    test_trace_child_debug: function(test){
      var t = new trace.Trace('test_trace', {traceId: 1, spanId: 1, debug: true});
      var c = t.child('child_test_trace');
      test.equal(c.traceId, 1);
      test.equal(c.parentSpanId, 1);
      test.equal(c.debug, true);
      test.done();
    },
    test_trace_child_passes_tracers: function(test){
      var o = {traceId: 1, spanId: 1, tracers: [1]};
      var t = new trace.Trace('test_trace', o);
      var c = t.child('child_test_trace');
      test.equal(c.traceId, 1);
      test.equal(c.parentSpanId, 1);
      test.equal(c._tracers[0], 1);
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
      test.deepEqual(tracer._calls.record[0], [[[t, [a]]]]);
      test.done();
    },
    test_record_does_not_invoke_tracer_when_not_sampled: function(test){
      var tracer, t, a;
      tracer = new mockTracer();
      t = new trace.Trace('test_trace', {
          traceId: 1, spanId: 1, tracers: [tracer], sampled: false
      });
      a = trace.Annotation.clientSend(0);
      t.record(a);

      test.equal(tracer._calls.record.length, 0);
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
      test.deepEqual(tracer._calls.record[0], [[[t, [a]]]]);
      test.deepEqual(a.endpoint, e);
      test.done();
    },
    test_toHeaders_no_parent_span: function(test) {
      var t = new trace.Trace('GET', {traceId: 1, spanId: 10});
      test.deepEqual(t.toHeaders(), {
        'X-B3-TraceId': '0000000000000001',
        'X-B3-SpanId': '000000000000000a',
        'X-B3-Sampled' : true
      });
      test.done();
    },
    test_toHeaders_parent_span: function(test) {
      var t = new trace.Trace('GET', {traceId: 1, spanId: 10, parentSpanId: 5});
      test.deepEqual(t.toHeaders(), {
        'X-B3-TraceId': '0000000000000001',
        'X-B3-SpanId': '000000000000000a',
        'X-B3-ParentSpanId': '0000000000000005',
        'X-B3-Sampled' : true
      });
      test.done();
    },
    test_toHeaders_add_to_existing_header: function(test) {
      var t = new trace.Trace('GET', {traceId: 1, spanId: 10});
      var headers = {'Content-Type': 'application/json'};
      test.deepEqual(t.toHeaders(headers), {
        'X-B3-TraceId': '0000000000000001',
        'X-B3-SpanId': '000000000000000a',
        'X-B3-Sampled' : true,
        'Content-Type': 'application/json'
      });
      test.done();
    },
    test_fromHeaders_emtpy_headers: function(test) {
      // tests to make sure that without header ids, a valid trace is
      // still produced
      var t = trace.Trace.fromHeaders('GET', {});
      test.equal(t.name, 'GET');
      assert_is_valid_trace(test, t);
      test.done();
    },
    test_fromHeaders_without_parent_id: function(test) {
      var t = trace.Trace.fromHeaders('POST',
        {
          'x-b3-traceid': '000000000000000a',
          'x-b3-spanid': '000000000000000a'
        });

      test.equal(t.name, 'POST');
      test.equal(t.traceId, formatters._hexStringify(10));
      test.equal(t.spanId, formatters._hexStringify(10));
      test.equal(t.parentSpanId, undefined);
      test.done();
    },
    test_fromHeaders_with_parent_id: function(test) {
      var t = trace.Trace.fromHeaders('POST',
        {
          'x-b3-traceid': '0000000000000001',
          'x-b3-spanid': '000000000000000a',
          'x-b3-parentspanid': '0000000000000005'
        });

      test.equal(t.name, 'POST');
      test.equal(t.traceId, formatters._hexStringify(1));
      test.equal(t.spanId, formatters._hexStringify(10));
      test.equal(t.parentSpanId, formatters._hexStringify(5));
      test.done();
    },
    test_fromHeaders_with_sampled: function(test) {
      var t = trace.Trace.fromHeaders('POST',
        {
          'x-b3-traceid': '0000000000000001',
          'x-b3-spanid': '000000000000000a',
          'x-b3-sampled': false
        });

      test.equal(t.name, 'POST');
      test.equal(t.traceId, formatters._hexStringify(1));
      test.equal(t.spanId, formatters._hexStringify(10));
      test.equal(t.sampled, false);
      test.done();
    },
    test_fromRequest_calls_fromHeaders: function(test) {
      var orig = trace.Trace.fromHeaders;
      var test_headers = {'hat': 'cat'};
      trace.Trace.fromHeaders = function(traceName, headers) {
        try {
          test.equal(traceName, 'POST');
          test.equal(headers, test_headers); // should be the same reference
        } finally {
          // always clean up
          trace.Trace.fromHeaders = orig;
        }
        return trace.Trace.fromHeaders(traceName, headers);
      };
      trace.Trace.fromRequest({method: 'POST', headers: test_headers});
      test.done();
    },
    test_fromRequest_defaults_sampled_behaviour_to_sampled : function(test){
        var request = {
            'headers' : {
               'x-b3-traceid': '0000000000000001',
               'x-b3-spanid': '000000000000000a'
            }
        };
        var t = trace.Trace.fromRequest(request, 'test');
        test.equal(t.sampled, true);
        test.done();
    },
    test_fromRequest_honours_inbound_dont_sample_header_over_local_do_sample_indicator : function(test){
        var request = {
            'headers' : {
               'x-b3-traceid': '0000000000000001',
               'x-b3-spanid': '000000000000000a',
               'x-b3-sampled': false
            }
        };
        var t = trace.Trace.fromRequest(request, 'test', true);
        test.equal(t.sampled, false);
        test.done();
    },
    test_fromRequest_honours_inbound_do_sample_header_over_local_dont_sample_indicator : function(test){
        var request = {
            'headers' : {
               'x-b3-traceid': '0000000000000001',
               'x-b3-spanid': '000000000000000a',
               'x-b3-sampled': true
            }
        };
        var t = trace.Trace.fromRequest(request, 'test', false);
        test.equal(t.sampled, true);
        test.done();
    },
    test_fromRequest_honours_local_sampled_indicator_in_the_absence_of_an_inbound_sampled_header : function(test){
        var request = {
            'headers' : {
               'x-b3-traceid': '0000000000000001',
               'x-b3-spanid': '000000000000000a'
            }
        };
        var t = trace.Trace.fromRequest(request, 'test', false);
        test.equal(t.sampled, false);
        test.done();
    },
    test_fromRequest_default_endpoint: function(test) {
      var t = trace.Trace.fromRequest({method: 'GET', headers: {}});
      test.equal(t.endpoint.ipv4, '127.0.0.1');
      test.equal(t.endpoint.port, 80);
      test.equal(t.endpoint.serviceName, "http");
      test.done();
    },
    test_fromRequest_endpoint_from_address_info: function(test) {
      var t = new trace.Trace.fromRequest({
        method: 'GET',
        headers: {},
        socket: {
          address: function() {
            return {family: 2, port: 8888, address: '1.2.3.4'};
          }
        }
      });
      test.equal(t.endpoint.ipv4, '1.2.3.4');
      test.equal(t.endpoint.port, 8888);
      test.done();
    },
    test_fromRequest_endpoint_with_servicename: function(test) {
      var t = new trace.Trace.fromRequest(
        {method: 'GET', headers: {}}, 'this_is_a_service');
      test.equal(t.endpoint.serviceName, "this_is_a_service");
      test.done();
    },
    test_fromRequest_endpoint_with_ipv6_localhost: function(test) {
      var t = new trace.Trace.fromRequest({
        method: 'GET',
        headers: {},
        socket: {
          address: function() {
            return {family: 2, port: 8888, address: '::1'};
          }
        }
      });
      test.equal(t.endpoint.ipv4, '127.0.0.1');
      test.equal(t.endpoint.port, 8888);
      test.done();
    },
    test_fromRequest_endpoint_with_ipv6_mapped_localhost: function(test) {
      var t = new trace.Trace.fromRequest({
        method: 'GET',
        headers: {},
        socket: {
          address: function() {
            return {family: 2, port: 8888, address: '::ffff:127.0.0.1'};
          }
        }
      });
      test.equal(t.endpoint.ipv4, '127.0.0.1');
      test.equal(t.endpoint.port, 8888);
      test.done();
    },
    test_fromRequest_endpoint_with_other_ipv6: function(test) {
      var t = new trace.Trace.fromRequest({
        method: 'GET',
        headers: {},
        socket: {
          address: function() {
            return {family: 2, port: 8888, address: '2001:db8::ff00:42:8329'};
          }
        }
      });
      test.equal(t.endpoint.ipv4, '0.0.0.0');
      test.equal(t.endpoint.port, 8888);
      test.done();
    }
  },
  annotationTests: {
    setUp: function(cb){
      trace._overrideGetNowMicros(function() {
        return 1000000;
      });
      cb();
    },
    test_timestamp: function(test) {
      runAnnotationTest(test, trace.Annotation.timestamp('test'), 'test',
                        1000000, 'timestamp');
    },
    test_timestamp_with_duration: function(test) {
      runAnnotationTest(test, trace.Annotation.timestamp('test', undefined, 123), 'test',
                        1000000, 'timestamp', 123);
    },
    test_client_send: function(test) {
      runAnnotationTest(test, trace.Annotation.clientSend(), 'cs', 1000000,
                        'timestamp');
    },
    test_client_recv: function(test) {
      runAnnotationTest(test, trace.Annotation.clientRecv(), 'cr', 1000000,
                        'timestamp');
    },
    test_server_send: function(test) {
      runAnnotationTest(test, trace.Annotation.serverSend(), 'ss', 1000000,
                        'timestamp');
    },
    test_server_recv: function(test) {
      runAnnotationTest(test, trace.Annotation.serverRecv(), 'sr', 1000000,
                        'timestamp');
    },
    test_string: function(test) {
      runAnnotationTest(test, trace.Annotation.string('myname', 'ispi'),
                        'myname', 'ispi', 'string');
    },
    test_uri: function(test) {
      var uri = 'http://example.com';
      runAnnotationTest(test, trace.Annotation.uri(uri), 'http.uri', uri,
                        'string');
    }
  }
};
