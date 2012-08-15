var tracers = require('../tracers');

var run_test = function(testFunc){
  return function(test, assert){
    tracers.setTracers([]);
    testFunc(assert);
    tracers.setTracers([]);
    test.finish();
  };
};

exports.test_set_tracers = run_test(function(assert){
  var tracer = ["a"];
  tracers.setTracers(tracer);
  assert.deepEqual(tracers.getTracers(), tracer);
});

exports.test_push_tracer = run_test(function(assert){
  var dummy_tracer = "1";
  var dummy_tracer2 = "2";

  tracers.pushTracer(dummy_tracer);
  assert.deepEqual(tracers.getTracers(), [dummy_tracer]);
  tracers.pushTracer(dummy_tracer2);
  assert.deepEqual(tracers.getTracers(),
    [dummy_tracer, dummy_tracer2]);
});

exports.test_set_trace_args = run_test(function(assert){
  var tracer = ["i'm a tracer"];
  tracers.setTracers(tracer);
  assert.deepEqual(tracers.getTracers(), tracer);

  tracer = 2;
  tracers.setTracers(tracer);
  assert.deepEqual(tracers.getTracers(), [tracer]);
});