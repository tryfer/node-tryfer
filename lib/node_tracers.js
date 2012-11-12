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

var async = require('async');

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
   * @param {Object} options Options object with the following possible keys:
   * - batchMode - Enable batch mode and send messages to the backend after X
   *  messages have been queued or if more than Y seconds have passed since the
   *  last sending instead of sendind them immediately.
   * - batchSendAfterMsgs - How many messages need to be queued up before sending
   *   them to the backend.
   * - batchSendAfterInterval - Maximum amount of time (in ms) to wait before
   *   sending messages to backend
   */
  module.exports.RESTkinTracer = function(trace_url, keystone_client, options) {
    options = options || {};
    var self = this;

    if (trace_url.charAt(trace_url.length - 1) === '/') {
      trace_url = trace_url.slice(0, -1);
    }

    this.trace_url = trace_url;
    this.keystone_client = keystone_client;

    this._batchMode = options.batchMode || false;
    this._sendAfterMsgs = options.batchSendAfterMsgs || 10;
    this._sendAfterInterval = options.batchSendAfterInterval || (60 * 1000);
    this._lastSendTs = Date.now();
    this._queue = [];

    this.make_request = function (token, tenantId, body, callback) {
      var url = trace_url + '/' + tenantId + '/trace';

      request.post({
        url: url,
        headers: {
          "X-Auth-Token": token,
          "X-Tenant-Id": tenantId,
          "Content-Type": "application/json"
        },
        body: body
      }, callback);
    };

    self.sendTrace = function(trace, annotations) {
      var now = Date.now(), values;

      if (self._batchMode) {
        self._queue.push([trace, annotations]);

        if ((self._queue.length >= self._sendAfterMsgs) || ((self._lastSendTs + self._sendAfterInterval) < now)) {
          values = self._queue.slice();
          self._queue = [];

          formatters.formatTracesForRestkin(values, function(err, result) {
            self._sendTraceToBackend(result);
          });
        }
      }
      else {
        formatters.formatForRestkin(trace, annotations, function(err, result) {
          self._sendTraceToBackend(result);
        });
      }
    };

    self._sendTraceToBackend = function(body) {
      self._lastSendTs = Date.now();

      async.waterfall([
        self.keystone_client.getTenantIdAndToken.bind(null, {}),

        function makeRequest(result, callback) {
          self.make_request(result.token, result.tenantId, body, callback);
        }
      ],

      function(err) {
        if (err) {
          console.log('Failed to send trace to backend: ' + err.toString());
        }
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
