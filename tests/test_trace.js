
var ass = require('nodeunit').assert;
var util = require('util');

var _ = require("underscore");

var trace = require('../trace');

var MAX_ID = Math.pow(2, 31) -1;

ass.isNum = function(num, message){
  console.log(this);
  ass.equal(isNaN(num), false,
    util.format("%s is not number like", num));
};

var tracers = require('../tracers');

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
    test_record_invokes_tracer: function(test){
    var tracer, t, a;
    tracer = new mockTracer();
    t = new trace.Trace('test_trace', {
      traceId: 1, spanId: 1, tracers: [tracer]
    });
    a = trace.Annotation.clientSend(0);
    t.record(a);
    test.equal(1,1);
    test.deepEqual(tracer._calls.record[0], [t,a]);
    test.done();
  },
  test_trace_child: function(test){
    var t = new trace.Trace('test_trace', {traceId: 1, spanId: 1});
    var c = t.child('child_test_trace');
    test.equal(c.traceId, 1);
    test.equal(c.parentSpanId, 1);
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

//         tracer.record.test_called_with(t, annotation)

//         self.testEqual(annotation.endpoint, web_endpoint)


// class AnnotationTests(TestCase):
//     def setUp(self):
//         self.time_patcher = mock.patch('tryfer.trace.time.time')
//         self.time = self.time_patcher.start()
//         self.time.return_value = 1

//     def tearDown(self):
//         self.time_patcher.stop()

//     def test_timestamp(self):
//         a = Annotation.timestamp('test')
//         self.testEqual(a.value, 1000000)
//         self.testEqual(a.name, 'test')
//         self.testEqual(a.annotation_type, 'timestamp')

//     def test_client_send(self):
//         a = Annotation.client_send()
//         self.testEqual(a.value, 1000000)
//         self.testEqual(a.name, 'cs')
//         self.testEqual(a.annotation_type, 'timestamp')

//     def test_cleint_recv(self):
//         a = Annotation.client_recv()
//         self.testEqual(a.value, 1000000)
//         self.testEqual(a.name, 'cr')
//         self.testEqual(a.annotation_type, 'timestamp')

//     def test_server_send(self):
//         a = Annotation.server_send()
//         self.testEqual(a.value, 1000000)
//         self.testEqual(a.name, 'ss')
//         self.testEqual(a.annotation_type, 'timestamp')

//     def test_server_recv(self):
//         a = Annotation.server_recv()
//         self.testEqual(a.value, 1000000)
//         self.testEqual(a.name, 'sr')
//         self.testEqual(a.annotation_type, 'timestamp')
