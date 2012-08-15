
//var ass = require('assert');
var util = require('util');

var _ = require("underscore");

var trace = require('../trace');

var MAX_ID = Math.pow(2, 31) -1;

// ass.isNum = function(num, message){
//   ass.equal(isNaN(num), false,
//     util.format("%s is not number like", num));
// };

var tracers = require('../tracers');

var mockTracer = function(name, id, endpoint){
  var self = this;
  self.name = name;
  self.id = id;
  self.endpoint = endpoint;
  self._calls = {record: []};
  self.record = function(){
    self._calls.record.push(arguments);
  };
};

var tests = {
  test_new_trace: function(assert){
    var t = new trace.Trace('test_trace');
    assert.notEqual(t.traceId, undefined);
    //assert.isNum(t.traceId);
    assert.ok(t.traceId < MAX_ID);

    assert.notEqual(t.spanId, undefined);
    //assert.isNum(t.spanId);
    assert.ok(t.spanId < MAX_ID);

    assert.equal(t.parentSpanId, undefined);
  },
  test_trace_child: function(assert){
    var t = new trace.Trace('test_trace', {traceId: 1, spanId: 1});
    var c = t.child('child_test_trace');
    assert.equal(c.traceId, 1);
    assert.equal(c.parentSpanId, 1);
  },
  test_record_invokes_tracer: function(assert){
    var tracer, t, a;
    tracer = new mockTracer();
    t = new trace.Trace('test_trace', {
      traceId: 1, spanId: 1, tracers: [tracer]
    });
    a = trace.Annotation.clientSend(0);
    t.record(a);
    assert.deepEqual(tracer._calls.record[0], [t,a]);
  }
};

var run_test = function(name, testFunc){
  return function(test, assert){
    f = test.finish;
    test.finish = function(){
      try{
        throw new Error();
      }catch (e){
        console.log(name, e.stack);
      }
      f();
    };
    tracers.setTracers([]);
    testFunc(assert, test);
    tracers.setTracers([]);
    test.finish();
  };
};

_.each(tests, function(testFunc, name){
  exports[name] = run_test(name, testFunc);
});



//     def 
//         

//         
//         
//         

//         

//     def test_record_sets_annotation_endpoint(self):
//         tracer = mock.Mock()
//         web_endpoint = Endpoint('127.0.0.1', 8080, 'web')

//         t = Trace('test_trace', trace_id=1, span_id=1, tracers=[tracer])
//         t.set_endpoint(web_endpoint)
//         annotation = Annotation.client_send(timestamp=1)
//         t.record(annotation)

//         tracer.record.assert_called_with(t, annotation)

//         self.assertEqual(annotation.endpoint, web_endpoint)


// class AnnotationTests(TestCase):
//     def setUp(self):
//         self.time_patcher = mock.patch('tryfer.trace.time.time')
//         self.time = self.time_patcher.start()
//         self.time.return_value = 1

//     def tearDown(self):
//         self.time_patcher.stop()

//     def test_timestamp(self):
//         a = Annotation.timestamp('test')
//         self.assertEqual(a.value, 1000000)
//         self.assertEqual(a.name, 'test')
//         self.assertEqual(a.annotation_type, 'timestamp')

//     def test_client_send(self):
//         a = Annotation.client_send()
//         self.assertEqual(a.value, 1000000)
//         self.assertEqual(a.name, 'cs')
//         self.assertEqual(a.annotation_type, 'timestamp')

//     def test_cleint_recv(self):
//         a = Annotation.client_recv()
//         self.assertEqual(a.value, 1000000)
//         self.assertEqual(a.name, 'cr')
//         self.assertEqual(a.annotation_type, 'timestamp')

//     def test_server_send(self):
//         a = Annotation.server_send()
//         self.assertEqual(a.value, 1000000)
//         self.assertEqual(a.name, 'ss')
//         self.assertEqual(a.annotation_type, 'timestamp')

//     def test_server_recv(self):
//         a = Annotation.server_recv()
//         self.assertEqual(a.value, 1000000)
//         self.assertEqual(a.name, 'sr')
//         self.assertEqual(a.annotation_type, 'timestamp')
