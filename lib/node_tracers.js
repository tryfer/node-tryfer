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
 * Tracers only for Node.
 * Note: Node tracers assume tryfer library is included in a long running
 * process.
 */

(function () {
  if (typeof module === 'undefined' || !module.exports) {
    return;
  }

  var util = require('util');

  var request = require('request');
  var async = require('async');

  var EndAnnotationTracer = require('./tracers').EndAnnotationTracer;
  var formatters = require('./formatters');

  /**
   * Buffer traces and defer recording until maxTraces have been received or
   * maxIdleTime has elapsed since the last trace was recorded.
   *
   * @param {Tracer} tracer Tracer provider to record buffered tracers to.
   * @param {Options} options Options object with the following keys:
   * - maxTraces - Number of traces to buffer before recording occurs (default:
   *   50).
   * - maxIdleTime - A maximum number of seconds which can pass since the last
   *   trace was received before sending all the buffered traces (default: 10).
   */
  module.exports.BufferingTracer = function(tracer, options) {
    var self = this;

    this._tracer = tracer;
    this._maxTraces = options.maxTraces || 50;
    this._maxIdleTime = options.maxIdleTime ? (options.maxIdleTime * 1000) : 10 * 1000;
    this._lastSentTs = Date.now();
    this._buffer = [];
    this._stopped = false;

    this.sendTraces = function(traces) {
      var buffer;

      this._buffer = this._buffer.concat(traces);

      if (this._buffer.length >= this._maxTraces) {
        buffer = this._buffer.slice();
        this._buffer = [];

        // Flush the buffer in the next tick
        process.nextTick(this._sendTraces.bind(this, buffer));
      }
    };

    /**
     * Clear any outgoing timers and stop the tracer.
     */
    this.stop = function() {
      clearTimeout(this._periodSendTimeoutId);
      this._stopped = true;
    }

    this._periodicSendFunction = function() {
      var now = Date.now(), buffer;

      if (((now - this._maxIdleTime) > this._lastSentTs) &&
          this._buffer.length >= 1) {
        buffer = this._buffer.slice();
        this._buffer = [];
        this._sendTraces(buffer);
      }

      // Re-schedule itself
      this._periodSendTimeoutId = setTimeout(this._periodicSendFunction.bind(this),
                                           this._maxIdleTime);

    }

    this._sendTraces = function(traces) {
      this._lastSentTs = Date.now();
      this._tracer.sendTraces(traces);
    };

    this._periodSendTimeoutId = setTimeout(this._periodicSendFunction.bind(this),
                                           this._maxIdleTime);
  };

  /**
   * A tracer that records to zipkin through the RESTkin http interface.
   * Requires a keystone client ({node-keystone-client}).
   *
   * This implementation posts all traces immediately and does not implement
   * buffering.
   *
   * @param {String} traceUrl The URL to the RESTkin endpoint including the
   * version. For example: https://example.com/v1.0
   * @param {keystone-client.KeystoneClient object} keystoneClient The
   * keystone client to use to authenticate against keystone to get a token
   * and tenant id.
   */
  module.exports.RawRESTkinHTTPTracer = function(traceUrl, keystoneClient) {
    var self = this;

    if (traceUrl.charAt(traceUrl.length - 1) === '/') {
      traceUrl = traceUrl.slice(0, -1);
    }

    this.traceUrl = traceUrl;
    this.keystoneClient = keystoneClient;

    this.performRequest = function (token, tenantId, body, callback) {
      var url = traceUrl + '/' + tenantId + '/trace', headers;

      headers = {
        'X-Auth-Token': token,
        'X-Tenant-Id': tenantId,
        'Content-Type': 'application/json'
      };

      request.post({
        url: url,
        headers: headers,
        body: body
      }, callback);
    };

    self.sendTraces = function(traces) {
      async.waterfall([
        self.keystoneClient.getTenantIdAndToken.bind(null, {}),

        function formatTraces(result, callback) {
          formatters.formatTracesForRestkin(traces, function(err, formattedTraces) {
            callback(err, result, formattedTraces);
          });
        },

        function makeRequest(result, formattedTraces, callback) {
          self.performRequest(result.token, result.tenantId, formattedTraces, callback);
        }
      ],

      function(err) {
        if (err) {
          console.log('Failed to send traces to backend: ' + err.toString());
        }
      });
    };

    EndAnnotationTracer.call(self, self.sendTraces);
  };

  util.inherits(module.exports.RawRESTkinHTTPTracer, EndAnnotationTracer);

  /**
   * A tracer that records to zipkin through the RESTkin http interface.
   * Requires a keystone client ({node-keystone-client}).
   *
   * This is equivalent to EndAnnotationTracer(BufferingTracer(RawRESTkinHTTPTracerTests())).
   *
   * @param {String} traceUrl The URL to the RESTkin endpoint including the
   * version. For example: https://example.com/v1.0
   * @param {keystone-client.KeystoneClient object} keystoneClient The
   * keystone client to use to authenticate against keystone to get a token
   * and tenant id.
   * @param {Object} options Options passed to the BufferingTracer constructor.
   */
  module.exports.RESTkinHTTPTracer = function(traceUrl, keystoneClient, options) {
    var rawTracer = new module.exports.RawRESTkinHTTPTracer(traceUrl, keystoneClient);
    this._tracer = new module.exports.BufferingTracer(rawTracer, options);

    this.sendTraces = function(traces) {
      this._tracer.sendTraces(traces);
    };

    this.stop = this._tracer.stop.bind(this._tracer);

    EndAnnotationTracer.call(this, this.sendTraces);
  };

  util.inherits(module.exports.RESTkinHTTPTracer, EndAnnotationTracer);

  /**
   * A tracer that records to zipkin through scribe. Requires a scribe
   * client ({node-scribe}).
   *
   * @param {scribe.Scribe object} scribeClient The client to use to write to
   *    scribe
   * @param {String} category The category to use when writing to scribe -
   *    defaults to "zipkin" if not passed
   */
  module.exports.RawZipkinTracer = function(scribeClient, category) {
    var self = this;
    this.scribeClient = scribeClient;
    this.category = (category) ? category : 'zipkin';

    this.sendTraces = function(traces) {
      traces.forEach(function(tuple) {
        var trace, annotations;

        trace = tuple[0];
        annotations = tuple[1];
        formatters.formatForZipkin(trace, annotations, function(err, base64) {
          self.scribeClient.send(self.category, base64);
        });
      });
    };

    EndAnnotationTracer.call(self, self.sendTraces);
  };

  util.inherits(module.exports.RawZipkinTracer, EndAnnotationTracer);

  /**
   * A tracer that records to zipkin through scribe. Requires a scribe
   * client ({node-scribe}).
   *
   * @param {scribe.Scribe object} scribeClient The client to use to write to
   *    scribe
   * @param {String} category The category to use when writing to scribe -
   *    defaults to "zipkin" if not passed
   */
  module.exports.ZipkinTracer = function(scribeClient, category, options) {
    var rawTracer = new RawZipkinTracer(scribeClient, category);
    this._tracer = new BufferingTracer(rawTracer, options);

    this.sendTraces = function(traces) {
      this._tracer.sendTraces(traces);
    };

    this.stop = this._tracer.stop.bind(this._tracer);

    EndAnnotationTracer.call(this, this.sendTraces);
  };

  util.inherits(module.exports.ZipkinTracer, EndAnnotationTracer);

  /**
   * A tracer that records to RESTkin through scribe.  Requires a scribe
   * client ({node-scribe}).
   *
   * This implementation logs all annotations immediately and does not implement
   * buffering of any sort.
   *
   * @param {scribe.Scribe object} scribeClient The client to use to write to
   *    scribe
   * @param {String} category The category to use when writing to scribe -
   *    defaults to "zipkin" if not passed
   */
  module.exports.RawRESTkinScribeTracer = function(scribeClient, category) {
    var self = this;
    this.scribeClient = scribeClient;
    this.category = (category) ? category : 'restkin';

    this.sendTraces = function(traces) {
      async.waterfall([
        formatters.formatTracesForRestkin.bind(null, traces),

        function send(formattedTraces, callback) {
          self.scribeClient.send(self.category, formattedTraces);
          callback();
        },
      ],

      function(err) {
        if (err) {
          console.log('Failed to send traces to backend: ' + err.toString());
        }
      });
    };

    EndAnnotationTracer.call(this, this.sendTraces);
  };

  util.inherits(module.exports.RawRESTkinScribeTracer, EndAnnotationTracer);

  /**
   * A tracer that records to RESTkin through scribe.  Requires a scribe
   * client ({node-scribe}).
   *
   * This implementation logs all annotations immediately and does not implement
   * buffering of any sort.
   *
   * @param {scribe.Scribe object} scribeClient The client to use to write to
   *    scribe
   * @param {String} category The category to use when writing to scribe -
   *    defaults to "zipkin" if not passed
   */
  module.exports.RESTkinScribeTracer = function(scribeClient, category) {
    this._tracer = new BufferingTracer(rawTracer, options);

    this.sendTraces = function(traces) {
      this._tracer.sendTraces(traces);
    };

    this.stop = this._tracer.stop.bind(this._tracer);

    EndAnnotationTracer.call(this, this.sendTraces);
  };

  util.inherits(module.exports.RESTkinScribeTracer, EndAnnotationTracer);
}());
