var util = require('util');

var _ = require("underscore");
var tprotocol = require('../node_modules/thrift/lib/thrift/protocol');
var ttransport = require('../node_modules/thrift/lib/thrift/transport');

var formatters = require('..').formatters;
var trace = require('..').trace;
var zipkinCore_types = require('../lib/_thrift/zipkinCore/zipkinCore_types');

var traces_and_annotations = {
  basic_trace_and_annotations: {
    trace: new trace.Trace('test', {spanId: 1, traceId:5}),
    annotations: [new trace.Annotation.timestamp('name1', 1),
                  new trace.Annotation.string('name2', '2')]
  }
};

// Helper function to convert a base64 string back into a span, and then to
// run tests on it
var testBase64Thrift = function (base64str, test_callback) {
  var b = new Buffer(base64str, "base64");
  var trans_receiver = ttransport.TBufferedTransport.receiver(function(trans) {
    var prot = new tprotocol.TBinaryProtocol(trans);
    var span = new zipkinCore_types.Span();
    span.read(prot);
    test_callback(null, span);
  });
  trans_receiver(b);
};

module.exports = {
  restkinFormatterTests: {
    test_basic_trace_and_annotations: function(test){
      var testcase = traces_and_annotations.basic_trace_and_annotations;
      var expected = {
        trace_id: '5',
        span_id: '1',
        name: 'test',
        annotations: [
          {
            key: 'name1',
            value: 1,
            type: 'timestamp'
          },
          {
            key: 'name2',
            value: '2',
            type: 'string'
          }
        ]
      };
      formatters.formatForRestkin(testcase.trace, testcase.annotations,
        function(error, value) {
          test.equal(error, null);
          test.deepEqual(JSON.parse(value), expected);
          test.done();
        });
    },
    test_trace_with_parentSpanId: function(test){
      var t, a, expected;
      t = new trace.Trace('test', {parentSpanId:1, spanId: 2, traceId:5});
      a = [];
      expected = {
        trace_id: '5',
        parent_span_id: '1',
        span_id: '2',
        name: 'test',
        annotations: []
      };
      formatters.formatForRestkin(t, a, function(error, value) {
        test.equal(error, null);
        test.deepEqual(JSON.parse(value), expected);
        test.done();
      });
    },
    test_trace_with_annotation_with_endpoint: function(test) {
      var t, a, expected;
      t = new trace.Trace('test', {spanId: 1, traceId:5});
      a = [new trace.Annotation('name1', 1, 'test',
                                new trace.Endpoint('1.1.1.1', 5, 'service'))];
      expected = {
        trace_id: '5',
        span_id: '1',
        name: 'test',
        annotations: [
          {
            key: 'name1',
            value: 1,
            type: 'test',
            host: {
              ipv4: '1.1.1.1',
              port: 5,
              service_name: 'service'
            }
          }
        ]
      };
      formatters.formatForRestkin(t, a, function(error, value) {
        test.equal(error, null);
        test.deepEqual(JSON.parse(value), expected);
        test.done();
      });
    }
  },
  zipkinFormatterTests: {
    test_basic_trace_and_annotations: function(test){
      var testcase = traces_and_annotations.basic_trace_and_annotations;
      var expected = new zipkinCore_types.Span({
        trace_id: 5,
        id: 1,
        name: 'test',
        annotations: [ new zipkinCore_types.Annotation({
          timestamp: 1,
          value: 'name1'
        })],
        binary_annotations: [ new zipkinCore_types.BinaryAnnotation({
          value: '2',
          key: 'name2',
          annotation_type: zipkinCore_types.AnnotationType.STRING
        })]
      });
      formatters.formatForZipkin(testcase.trace, testcase.annotations,
        function(formatError, base64) {
          test.equal(formatError, null);
          testBase64Thrift(base64, function(parsingError, span) {
            test.deepEqual(span, expected);
            test.done();
          });
        });
    }
  }
};
