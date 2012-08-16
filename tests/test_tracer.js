var tracers = require('../tracers');

module.exports = {
  test_set_tracers: function(test){
    var tracer = ["a"];
    tracers.setTracers(tracer);
    test.deepEqual(tracers.getTracers(), tracer);
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
    var tracer = ["i'm a tracer"];
    tracers.setTracers(tracer);
    test.deepEqual(tracers.getTracers(), tracer);

    tracer = 2;
    tracers.setTracers(tracer);
    test.deepEqual(tracers.getTracers(), [tracer]);
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
};