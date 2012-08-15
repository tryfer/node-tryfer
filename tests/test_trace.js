
var ass = require('assert');
var util = require('util');
var trace = require('../trace');

var MAX_ID = Math.pow(2, 31) -1;

ass.isNum = function(num, message){
  ass.equal(isNaN(num), false,
    util.format("%s is not number like", num));
};

var tracers = require('../tracers');

var run_test = function(testFunc){
  return function(test, assert){
    tracers.setTracers([]);
    testFunc(assert);
    tracers.setTracers([]);
    test.finish();
  };
};

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


exports.test_new_trace = run_test(function(assert){
  var t = new trace.Trace('test_trace');
  assert.notEqual(t.traceId, undefined);
  assert.isNum(t.traceId);
  assert.ok(t.traceId < MAX_ID);

  assert.notEqual(t.spanId, undefined);
  assert.isNum(t.spanId);
  assert.ok(t.spanId < MAX_ID);

  assert.equal(t.parentSpanId, undefined);
});

exports.test_trace_child = run_test(function(assert){
  var t = new trace.Trace('test_trace', {traceId: 1, spanId: 1});
  var c = t.child('child_test_trace');
  assert.equal(c.traceId, 1);
  assert.equal(c.parentSpanId, 1);
  assert.notEqual(c.spanId, 1);
});
// });
// class TraceTests(TestCase):
//     def 
//         

//         

//         
//         
//         

//     def test_record_invokes_tracer(self):
//         tracer = mock.Mock()

//         t = Trace('test_trace', trace_id=1, span_id=1, tracers=[tracer])
//         annotation = Annotation.client_send(timestamp=0)
//         t.record(annotation)

//         tracer.record.assert_called_with(t, annotation)

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
