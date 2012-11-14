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
 * Formatters that can be used by tracers.  RESTkin expects the trace and
 * annotations to be a particular JSON format, and Zipkin/Scribe expects
 * base64-encoded thrift objects.
 */

(function () {
  var async = require('async');

  var formatForRestkin, formatForZipkin, hexStringify, ipv4ToNumber;
  var zipkinCore_types, thrift, ttransport, tprotocol;

  /**
   * Hexifies a string and zero-pads it until it is at least the desired length
   *
   * @param {Number} number The number to turn into a zero-padded hex string
   * @param {Number} length The desired length to zero-pad to - defaults to 16
   */
  hexStringify = function (number, length) {
    var hex_str = number.toString(16);
    if (length === undefined || length === null) {
      length = 16;
    }
    if (hex_str.length < length) {
      // plus 1, because if you want 15 zeros you need 16 empty elements (
      // 15 = negative space between elements)
      return (new Array(length + 1 - hex_str.length)).join("0") + hex_str;
    } else {
      return hex_str;
    }
  };

  /**
   * Formats the trace and annotation to be accepted by RESTkin - note that
   * the trace_id, span_id, and parent_span_id are zero-padded hex strings of
   * length 16
   *
   * @param {Trace} trace Trace to format
   * @param {Array} of {Annotation} annotations Annotations to format
   * @param {Function} callback Callback called with (err, formattedResult).
   */
  _formatForRestkin = function (trace, annotations, callback) {
    var self = this;
    var annJson;
    var restkinTrace = {
      trace_id: hexStringify(trace.traceId),
      span_id: hexStringify(trace.spanId),
      name: trace.name,
      annotations: []
    };

    if (trace.parentSpanId !== undefined) {
      restkinTrace.parent_span_id = hexStringify(trace.parentSpanId);
    }

    Array.prototype.forEach.call(annotations, function(ann, idx) {
      annJson = {
        key: ann.name,
        value: ann.value,
        type: ann.annotationType
      };

      if (ann.endpoint !== undefined) {
        annJson.host = {
          ipv4: ann.endpoint.ipv4,
          port: ann.endpoint.port,
          service_name: ann.endpoint.serviceName
        };
      }

      restkinTrace.annotations.push(annJson);
    });

    callback(null, restkinTrace);
  };

  /**
   * Format multiple traces and annotations for RESTkin.
   *
   * @param {Array} values An array of [trace, annotations] tuples.
   * @param {Function} callback Callback called with (err, formattedResult).
   */
  formatForRestkin = function (values, callback) {
    async.map(values, function(tuple, callback) {
      var trace, annotations;

      trace = tuple[0];
      annotations = tuple[1];
      _formatForRestkin(trace, annotations, callback);
    },

    function(err, results) {
      if (err) {
        callback(err);
        return;
      }

      callback(null, JSON.stringify(results, null, 2));
    });
  };

  /*** ----- Node-specific, since the thrift relies on Buffers ---- ***/

  /**
   * Converts an IPv4 address ({[0-255].[0-255].[0-255].[0-255]}) to a number.
   * If the address is ill-formatted, raises an error
   *
   * formula is (first octet * 256^3) + (second octet * 256^2) +
   *    (third octet * 256) + (fourth octet)
   *
   * @param {String} ipv4 String containing the IPv4 address
   */
  ipv4ToNumber = function(ipv4) {
    var octets = ipv4.split(".");
    var sum = 0, i;

    if(octets.length != 4) {
      throw new Error("IPv4 string does not have 4 parts.");
    }

    for (i=0; i<4; i++) {
      var octet = parseInt(octets[i], 10);
      if (isNaN(octet) || octet < 0 || octet > 255) {
        throw new Error("IPv4 string contains a value that is not a number " +
                        "between 0 and 255 inclusive");
      }

      sum = (sum << 8) + octet;
    }

    return sum;
  };

  /**
   * Formats the trace and annotation to be accepted by Zipkin over Scribe,
   * which takes base 64 thrift
   *
   * @param {Trace} trace Trace to format
   * @param {Array} of {Annotation} annotations Annotations to format
   * @param {Function} callback Callback to call with the restkin-formatted
   *    trace
   */
  formatForZipkin = function(trace, annotations, callback) {
    var self = this;
    var thriftAnn = [], binaryAnn = [],
        ttype_args, trans, prot, tspan;

    Array.prototype.forEach.call(annotations, function(ann, idx) {
      ttype_args = {value: ann.value};
      if (ann.endpoint !== undefined) {
        ttype_args.host = new zipkinCore_types.Endpoint({
          ipv4: ipv4ToNumber(ann.endpoint.ipv4),
          port: ann.endpoint.port,
          service_name: ann.endpoint.serviceName
        });
      }

      if (ann.annotationType === 'timestamp') {
        ttype_args.timestamp = ann.value;
        ttype_args.value = ann.name;
        thriftAnn.push(new zipkinCore_types.Annotation(ttype_args));
      } else {
        ttype_args.key = ann.name;
        ttype_args.value = ttype_args.value.toString();
        ttype_args.annotation_type = zipkinCore_types.AnnotationType.STRING;
        binaryAnn.push(new zipkinCore_types.BinaryAnnotation(ttype_args));
      }
    });

    tspan = new zipkinCore_types.Span({
      trace_id: trace.traceId,
      name: trace.name,
      id: trace.spanId,
      parent_id: trace.parentSpanId,
      annotations: thriftAnn,
      binary_annotations: binaryAnn
    });

    // HERE do something to base64 encode thrift stuff
    trans = new ttransport.TBufferedTransport(null, function(buffer) {
      if (callback !== undefined) {
        callback(null, buffer.toString('base64').trim());
      }
    });
    // writeBufferSize is not actually used to allocate a buffer, but to
    // determine when a buffer must be flushed.
    trans.writeBufferSize = Math.pow(1024, 3);

    prot = new tprotocol.TBinaryProtocol(trans);

    tspan.write(prot);
    trans.flush();
  };

  if (typeof module !== 'undefined' && module.exports) {
    thrift = require('thrift');
    zipkinCore_types = require('./_thrift/zipkinCore/zipkinCore_types');
    ttransport = require('../node_modules/thrift/lib/thrift/transport');
    tprotocol = require('../node_modules/thrift/lib/thrift/protocol');
    module.exports = {
      _hexStringify: hexStringify,
      formatForRestkin: formatForRestkin,
      formatForZipkin: formatForZipkin
    };
  } else {
    this._hexStringify = hexStringify;
    this.formatForRestkin = formatForRestkin;
  }
}());
