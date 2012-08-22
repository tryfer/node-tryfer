/**
 * Formatters that can be used by tracers
 */

(function () {
  var formatForRestkin, formatForZipkin, zeroPad, ipv4ToNumber;
  var zipkinCore_types, thrift, ttransport, tprotocol;

  /**
   * Zero-pads a string until it is at least the desired length
   *
   * @param {String} smallStr The string to zero-pad
   * @param {Number} length The desired length to zero-pad to - defaults to 16
   */
  zeroPad = function (smallStr, length) {
    if (length === undefined || length === null) {
      length = 16;
    }
    if (smallStr.length < length) {
      // plus 1, because if you want 15 zeros you need 16 empty elements (
      // 15 = negative space between elements)
      return (new Array(length + 1 - smallStr.length)).join("0") + smallStr;
    } else{
      return smallStr;
    }
  };

  /**
   * Formats the trace and annotation to be accepted by RESTkin - note that
   * the trace_id, span_id, and parent_span_id are zero-padded hex strings of
   * length 16
   *
   * @param {Trace} trace Trace to format
   * @param {Array} of {Annotation} annotations Annotations to format
   * @param {Function} callback Callback to call with the restkin-formatted
   *    trace
   */
  formatForRestkin = function (trace, annotations, callback) {
    var self = this;
    var annJson;
    var restkinTrace = {
      trace_id: zeroPad(trace.traceId.toString(16)),
      span_id: zeroPad(trace.spanId.toString(16)),
      name: trace.name,
      annotations: []
    };

    if (trace.parentSpanId !== undefined) {
      restkinTrace.parent_span_id = zeroPad(trace.parentSpanId.toString(16));
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

    if (callback !== undefined) {
      callback(null, JSON.stringify([restkinTrace]));
    }
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
        console.log(ipv4);
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
      formatForRestkin: formatForRestkin,
      formatForZipkin: formatForZipkin
    };
  } else {
    this.formatForRestkin = formatForRestkin;
  }
}());
