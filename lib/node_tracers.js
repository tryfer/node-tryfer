// Copyright 2012 Rackspace Hosting, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * Tracers only for Node
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
   * @param {String} trace_url The URL to the RESTkin endpoint including the
   * version. For example: https://example.com/v1.0
   * @param {keystone-client.KeystoneClient object} keystone_client The
   *    keystone client to use to authenticate against keystone to get a token
   *    and tenant id
   */
  module.exports.RESTkinTracer = function(trace_url, keystone_client) {
    var self = this;

    if (trace_url.charAt(trace_url.length - 1) === '/') {
      trace_url = trace_url.slice(0, -1);
    }

    self.trace_url = trace_url;
    self.keystone_client = keystone_client;

    self.make_request = function (token, tenantId, err, body) {
      var url = trace_url + '/' + tenantId + '/trace';

      request.post({
        url: url,
        headers: {
          "X-Auth-Token": token,
          "X-Tenant-Id": tenantId,
          "Content-Type": "application/json"
        },
        body: body
      }, function(err) {
          if (err) {
            console.log('Error while sending trace to RESTkin endpoint: ' + err.toString());
          }
      });
    };

    self.sendTrace = function(trace, annotations) {
      self.keystone_client.getTenantIdAndToken({},
        function (err, result) {
          if (err) {
            console.log('Error while obtaining tenant id and token:' + err.toString());
            return;
          }

          formatters.formatForRestkin(trace, annotations,
            self.make_request.bind(self, result.token, result.tenantId));
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
