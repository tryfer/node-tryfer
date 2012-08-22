/**
 * Tracers
 */

(function () {

  if (typeof module === 'undefined' || !module.exports) {
    return;
  }

  var EndAnnotationTracer = require('./tracers').EndAnnotationTracer;
  var formatters = require('./formatters');
  var request = require('request');
  var util = require('util');

  module.exports.RESTkinTracer = function (trace_url, keystone_client) {
    var self = this;
    self.trace_url = trace_url;
    self.keystone_client = keystone_client;

    self.make_request = function (token, tenantId, err, body) {
      request.post({
        url: self.trace_url,
        headers: {"X-Auth-Token": token, "X-Tenant-Id": tenantId},
        body: body
      });
    };

    self.sendTrace = function(trace, annotations, cb) {
      self.keystone_client.getTenantIdAndToken(
        function (token, expires, tenantId) {
          formatters.formatForRestkin(trace, annotations,
            self.make_request.bind(self, token, tenantId));
        });
    };

    EndAnnotationTracer.call(self, self.sendTrace);
  };

  util.inherits(module.exports.RESTkinTracer, EndAnnotationTracer);
}());
