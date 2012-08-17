var tracers = require('..').tracers;
var trace = require('..').trace;

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
      var written = "", debug_tracer, t, a;
      var mock_stream = {
        write: function(data) { written  += data; }
      };

      debug_tracer = new tracers.DebugTracer(mock_stream);
      t = new trace.Trace('test', {traceId: 1, spanId:2, parentSpanId:1});
      a = new trace.Annotation.timestamp('mytime', 100);
      debug_tracer.record(t, a);

      test.equal(written,
                 "---\nAdding annotation for trace: 1:1:2:test\n\t" +
                 "mytime = 100:timestamp\n");
      test.done();
    }
  }
};
