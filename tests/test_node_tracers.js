var trace = require('..').trace;
var node_tracers = require('..').node_tracers;
var http = require('http');

var mockKeystoneClient = {
  getTenantIdAndToken: function(cb) {
    cb('1', 2, '3');
  }
};

module.exports = {
  restkinTests: {
    test_new_trace: function(test){
      var self = this;
      var t = new trace.Trace('clientRecv');
      var a = trace.Annotation.clientRecv(2);
      self.server = http.createServer(function(request, response) {
        test.equal(request.headers['x-auth-token'], '1');
        test.equal(request.headers['x-tenant-id'], '3');
        test.notEqual(request.headers['content-length'], '0');
        response.end();
        self.server.close();
        test.done();
      }).listen(22222, 'localhost');

      self.tracer = new node_tracers.RESTkinTracer('http://localhost:22222',
                                                   mockKeystoneClient);
      self.tracer.record(t, a);
    }
  }
};
