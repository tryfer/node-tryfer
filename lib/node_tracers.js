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

  /**
   * A tracer that records to zipkin through the RESTkin http interface.
   * Requires a keystone client ({node-keystone-client}).
   *
   * @param {String} trace_url The URL of RESTkin
   * @param {keystone-client.KeystoneClient object} keystone_client The
   *    keystone client to use to authenticate against keystone to get a token
   *    and tenant id
   */
  module.exports.RESTkinTracer = function (trace_url, keystone_client) {
    var self = this;
    self.trace_url = trace_url;
    self.keystone_client = keystone_client;

    self.make_request = function (token, tenantId, err, body) {
      request.post({
        url: self.trace_url,
        headers: {
          "X-Auth-Token": token,
          "X-Tenant-Id": tenantId,
          "Content-Type": "application/json"
        },
        body: body
      });
    };

    self.sendTrace = function(trace, annotations) {
      self.keystone_client.getTenantIdAndToken(
        function (token, expires, tenantId) {
          formatters.formatForRestkin(trace, annotations,
            self.make_request.bind(self, token, tenantId));
        });
    };

    EndAnnotationTracer.call(self, self.sendTrace);
  };

  util.inherits(module.exports.RESTkinTracer, EndAnnotationTracer);

  /**
   * A tracer that records to zipkin through scribe.  Requires a scribe
   * client ({node-scribe}).
   *
   * @param {scribe.Scribe object} scribe_client The client to use to write to
   *    scribe
   * @param {String} category The category to use when writing to scribe -
   *    defaults to "zipkin" if not passed
   */
  module.exports.ZipkinTracer = function (scribe_client, category) {
    var self = this;
    self.scribe_client = scribe_client;
    self.category = (category === undefined || !category) ? 'zipkin': category;

    self.sendTrace = function(trace, annotations) {
      formatters.formatForZipkin(trace, annotations, function(err, base64) {
        self.scribe_client.send(self.category, base64);
      });
    };

    EndAnnotationTracer.call(self, self.sendTrace);
  };

  util.inherits(module.exports.ZipkinTracer, EndAnnotationTracer);

  /**
   * A tracer that records to RESTkin through scribe.  Requires a scribe
   * client ({node-scribe}).
   *
   * @param {scribe.Scribe object} scribe_client The client to use to write to
   *    scribe
   * @param {String} category The category to use when writing to scribe -
   *    defaults to "zipkin" if not passed
   */
  module.exports.RESTkinScribeTracer = function (scribe_client, category) {
    var self = this;
    self.scribe_client = scribe_client;
    self.category = (category === undefined || !category) ? 'restkin': category;

    self.sendTrace = function(trace, annotations) {
      formatters.formatForRestkin(trace, annotations, function(err, json) {
        self.scribe_client.send(self.category, json);
      });
    };

    EndAnnotationTracer.call(self, self.sendTrace);
  };

  util.inherits(module.exports.RESTkinScribeTracer, EndAnnotationTracer);

}());
