var trace = require('..').trace;
var node_tracers = require('..').node_tracers;
var http = require('http');
var util = require('util');

var mockKeystoneClient = {
  getTenantIdAndToken: function(cb) {
    cb('1', 2, '3');
  }
};

var assert_is_base64 = function(test, string) {
  test.ok(string.search(/^([A-Za-z0-9+\/]{4})*([A-Za-z0-9+\/]{4}|[A-Za-z0-9+\/]{3}=|[A-Za-z0-9+\/]{2}==)$/) >= 0);
};

var assert_is_json_array = function(test, string) {
  var jsonObj = JSON.parse(string);
  test.ok(util.isArray(jsonObj));
  test.ok(jsonObj.length >= 1);
};

var FakeScribe = function(test) {
  var self = this;
  self.test = test;
  self.results = [];
  self.send = function(category, message) {
    self.results.push([category, message]);
  };
  self.assert_sent = function() {
    self.test.equal(self.results.length, 1);
    self.test.equal(self.results[0].length, 2);
  };
  self.assert_category = function(category) {
    self.test.equal(self.results[0][0], category);
  };
  self.assert_json = function() {
    assert_is_json_array(self.test, self.results[0][1]);
  };
  self.assert_base64 = function() {
    assert_is_base64(self.test, self.results[0][1]);
  };
};


module.exports = {
  setUp: function(cb) {
    var self = this;
    self.trace = new trace.Trace('clientRecv');
    self.annotation = trace.Annotation.clientRecv(2);
    cb();
  },
  test_restkin_tracer: function(test){
    var self = this;
    var server = http.createServer(function(request, response) {
      var postData, postLength = 0;
      test.equal(request.headers['x-auth-token'], '1');
      test.equal(request.headers['x-tenant-id'], '3');
      test.notEqual(request.headers['content-length'], '0');
      postData = new Buffer(
        parseInt(request.headers['content-length'], 10));

      // -- get the post data and assert that it is parsable as JSON, and
      // is a non-zero length array
      request.on('data', function(chunk){
        if (Buffer.isBuffer(chunk)) {
          chunk.copy(postData, postLength);
        } else {
          postData.write(chunk);
        }
        postLength += chunk.length;
      });

      request.on('end', function() {
        assert_is_json_array(test, postData.toString());
        response.end();
        server.close();
        test.done();
      });

    }).listen(22222, 'localhost');

    var tracer = new node_tracers.RESTkinTracer('http://localhost:22222',
                                                 mockKeystoneClient);
    tracer.record(self.trace, self.annotation);
  },
  test_zipkin_tracer_default_category: function(test){
    var self = this;
    var s = new FakeScribe(test);
    var t = new node_tracers.ZipkinTracer(s);
    t.record(self.trace, self.annotation);
    s.assert_sent();
    s.assert_category('zipkin');
    s.assert_base64();
    test.done();
  },
  test_zipkin_tracer_provided_category: function(test){
    var self = this;
    var s = new FakeScribe(test);
    var t = new node_tracers.ZipkinTracer(s, 'mycategory');
    t.record(self.trace, self.annotation);
    s.assert_sent();
    s.assert_category('mycategory');
    s.assert_base64();
    test.done();
  },
  test_restkin_scribe_tracer_default_category: function(test){
    var self = this;
    var s = new FakeScribe(test);
    var t = new node_tracers.RESTkinScribeTracer(s);
    t.record(self.trace, self.annotation);
    s.assert_sent();
    s.assert_category('restkin');
    s.assert_json();
    test.done();
  },
  test_restkin_scribe_tracer_provided_category: function(test){
    var self = this;
    var s = new FakeScribe(test);
    var t = new node_tracers.RESTkinScribeTracer(s, 'mycategory');
    t.record(self.trace, self.annotation);
    s.assert_sent();
    s.assert_category('mycategory');
    s.assert_json();
    test.done();
  },
  test_espresso: function(test) {
    var express = require('express');
    var http = require('http');


    var a = express();
    var s = http.createServer(a);

    a.get('/', function(req, res){
      res.end('done');
      s.close();
    });

    s.on('close', function(){
      console.log('le done');
      test.done();
    });

    s.listen('8001');
  }
};
