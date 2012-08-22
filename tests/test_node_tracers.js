var trace = require('..').trace;
var node_tracers = require('..').node_tracers;
var http = require('http');
var util = require('util');

var mockKeystoneClient = {
  getTenantIdAndToken: function(cb) {
    cb('1', 2, '3');
  }
};

var base64regex = /^([A-Za-z0-9+\/]{4})*([A-Za-z0-9+\/]{4}|[A-Za-z0-9+\/]{3}=|[A-Za-z0-9+\/]{2}==)$/;


module.exports = {
  test_restkin_tracer: function(test){
    var t = new trace.Trace('clientRecv');
    var a = trace.Annotation.clientRecv(2);

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
        var jsonObj;

        jsonObj = JSON.parse(postData.toString());
        test.ok(util.isArray(jsonObj));
        test.ok(jsonObj.length >= 1);

        response.end();
        server.close();
        test.done();
      });

    }).listen(22222, 'localhost');

    var tracer = new node_tracers.RESTkinTracer('http://localhost:22222',
                                                 mockKeystoneClient);
    tracer.record(t, a);
  },
  zipkin_Tracer: {
    setUp: function(cb) {
      var self = this;
      self.trace = new trace.Trace('clientRecv');
      self.annotation = trace.Annotation.clientRecv(2);
      self.results = [];
      self.fake_scribe = {
        send: function(category, message) {
          self.results.push([category, message]);
        }
      };
      cb();
    },
    test_zipkin_tracer_default_category: function(test){
      var self = this;
      var t = new node_tracers.ZipkinTracer(self.fake_scribe);
      t.record(self.trace, self.annotation);
      test.equal(self.results.length, 1);
      test.equal(self.results[0].length, 2);
      test.equal(self.results[0][0], 'zipkin');
      // ensure that the first message is a base64-encoded string
      test.ok(self.results[0][1].search(base64regex) >= 0);
      test.done();
    },
    test_zipkin_tracer_provided_category: function(test){
      var self = this;
      var t = new node_tracers.ZipkinTracer(self.fake_scribe, 'mycategory');
      t.record(self.trace, self.annotation);
      test.equal(self.results.length, 1);
      test.equal(self.results[0].length, 2);
      test.equal(self.results[0][0], 'mycategory');
      // ensure that the first message is a base64-encoded string
      test.ok(self.results[0][1].search(base64regex) >= 0);
      test.done();
    }
  }
};
