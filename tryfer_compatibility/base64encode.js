/*
Node script that produces base64 and json formats of a trace and a
set of annotations.
*/

var _ = require('underscore');

var formatters = require('..').formatters;
var trace = require('..').trace;

var sample_trace = new trace.Trace('trace', {
  traceId: 100, spanId: 10, parentSpanId: 5});
var sample_annotations = [new trace.Annotation.timestamp('mytime', 1),
                          new trace.Annotation.string('mystring', 'value')];

var expected_base64 = "CgABAAAAAAAAAGQLAAMAAAAFdHJhY2UKAAQAAAAAAAAACgoABQAAAAAAAAAFDwAGDAAAAAEKAAEAAAAAAAAAAQsAAgAAAAZteXRpbWUADwAIDAAAAAELAAEAAAAIbXlzdHJpbmcLAAIAAAAFdmFsdWUIAAMAAAAGAAA=";

var expected_json = '{"annotations": [{"type": "timestamp", "value": 1, "key": "mytime"}, {"type": "string", "value": "value", "key": "mystring"}], "parent_span_id": "0000000000000005", "trace_id": "0000000000000064", "name": "trace", "span_id": "000000000000000a"}';

formatters.formatForZipkin(sample_trace, sample_annotations,
  function(error, value) {
    if (expected_base64 !== value) {
      console.log('expected: ' + expected_base64 + "\nresult:   " + value);
    }
  });
formatters.formatForRestkin(sample_trace, sample_annotations,
  function(error, value) {
    var expected = JSON.parse(expected_json);
    var result = JSON.parse(value);
    if (!_.isEqual(result, expected)) {
      console.log('Expected:\n');
      console.log(expected);
      console.log('\nResult:\n');
      console.log(result);
    }
  });
