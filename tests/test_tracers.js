var tracers = require('..').tracers;
var trace = require('..').trace;
var formatters = require('..').formatters;

module.exports = {
  globalFunctions: {
    test_set_tracers: function(test){
      var dummy_tracer = ["a"];
      tracers.setTracers(dummy_tracer);
      test.deepEqual(tracers.getTracers(), dummy_tracer);
      test.done();
    },

    test_push_tracer: function(test){
      var dummy_tracer = "1";
      var dummy_tracer2 = "2";

      tracers.pushTracer(dummy_tracer);
      test.deepEqual(tracers.getTracers(), [dummy_tracer]);
      tracers.pushTracer(dummy_tracer2);
      test.deepEqual(tracers.getTracers(),
        [dummy_tracer, dummy_tracer2]);
      test.done();
    },

    test_set_trace_args: function(test){
      var dummy_tracer = ["i'm a tracer"];
      tracers.setTracers(dummy_tracer);
      test.deepEqual(tracers.getTracers(), dummy_tracer);

      dummy_tracer = 2;
      tracers.setTracers(dummy_tracer);
      test.deepEqual(tracers.getTracers(), [dummy_tracer]);
      test.done();
    },

    setUp: function(cb){
      tracers.setTracers([]);
      cb();
    },

    tearDown: function(cb){
      tracers.setTracers([]);
      cb();
    }
  },

  debugTracer: {
    test_writes_to_stream: function(test){
      // setup
      var written = '', debug_tracer, t, a, traces;
      var mock_stream = {
        write: function(data) { written  += data; }
      };

      debug_tracer = new tracers.DebugTracer(mock_stream);
      t = new trace.Trace('test', {traceId: 1, spanId:2, parentSpanId:1});
      a = new trace.Annotation.timestamp('mytime', 100);
      traces = [[t, [a]]];
      debug_tracer.record(traces);

      formatters.formatForRestkin(traces, function(err, json) {
        var expected = '--- Trace ---\n' + JSON.stringify(
                      JSON.parse(json), null, 2) + '\n';
        test.equal(written, expected);
        test.done();
      });
    }
  },

  endAnnotationTracer: {
    setUp: function(cb){
      var self = this;
      self.sent_traces = [];
      self.tracer = new tracers.EndAnnotationTracer(
        function(traces) {
          self.sent_traces.push(traces);
        });
      self.non_end_annotations = [
        trace.Annotation.timestamp('mytime', 1),
        trace.Annotation.clientSend(1),
        trace.Annotation.serverRecv(1),
        trace.Annotation.string("myname", "myval")
      ];
      cb();
    },

    test_record_non_end_annotations_does_not_send: function(test) {
      var self = this;
      var t = new trace.Trace('mytrace');
      self.non_end_annotations.forEach(function(annotation) {
        self.tracer.record([[t, [annotation]]]);
        test.equal(self.sent_traces.length, 0);
      });
      test.done();
    },

    test_record_sends_all_stored_on_end_annotation: function(test) {
      var self = this;
      var t = new trace.Trace('mytrace');
      var end_annotation = trace.Annotation.clientRecv(2);
      self.non_end_annotations.forEach(function(annotation) {
        self.tracer.record([[t, [annotation]]]);
      });

      self.tracer.record([[t, [end_annotation]]]);
      test.equal(self.sent_traces.length, 1);
      test.deepEqual(self.sent_traces[0][0],
                     [t, self.non_end_annotations.concat([end_annotation])]);
      test.done();
    },

    test_record_sends_on_clientRecv_and_serverSend: function(test) {
      var self = this;
      self.tracer.record([[new trace.Trace('clientRecv'),
                         [trace.Annotation.clientRecv(2)]]]);
      self.tracer.record([[new trace.Trace('serverSend'),
                         [trace.Annotation.serverSend(2)]]]);
      test.equal(self.sent_traces.length, 2);
      test.done();
    },

    test_record_for_child_spans: function(test) {
      var self = this;
      var span = new trace.Trace('server');
      self.tracer.record([[span,
                         [trace.Annotation.serverRecv(2)]]]);
      self.tracer.record([[span,
                         [trace.Annotation.string("http.uri", "/test", 2)]]]);

      var child = span.child("upstream");
      self.tracer.record([[child,
                         [trace.Annotation.string("http.uri", "/internal/test", 2)]]]);
      self.tracer.record([[child,
                         [trace.Annotation.clientSend(2)]]]);
      self.tracer.record([[child,
                         [trace.Annotation.clientRecv(2)]]]);

      self.tracer.record([[span,
                         [trace.Annotation.serverSend(2)]]]);

      test.equal(self.sent_traces.length, 2);
      // Check that we end up with 3 annotations for each span
      test.equal(self.sent_traces[0][0][1].length, 3);
      test.equal(self.sent_traces[1][0][1].length, 3);
      test.done();
    },

    test_annotation_records_do_not_grow_infinitely: function(test) {
      var self = this;
      var t = new trace.Trace('mytrace');

      test.equal(Object.keys(self.tracer.annotationsForSpan).length, 0);

      self.tracer.record([[t, [trace.Annotation.clientSend(2)]]]);
      test.equal(Object.keys(self.tracer.annotationsForSpan).length, 1);
      test.equal(
        Object.keys(self.tracer.annotationsForSpan[t.traceId]).length,
        1);

      self.tracer.record([[t, [trace.Annotation.clientRecv(2)]]]);

      test.equal(Object.keys(self.tracer.annotationsForSpan).length, 0);

      test.done();
    }
  }
};
