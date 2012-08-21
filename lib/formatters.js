/**
 * Formatters that can be used by tracers
 */

(function () {
  var formatForRestkin, formatForZipkin, TMemoryBuffer;
  var zipkinCore_types, thrift, ttransport, tprotocol;

  /**
   * Formats the trace and annotation to be accepted by RESTkin
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
      trace_id: trace.traceId.toString(16),
      span_id: trace.spanId.toString(16),
      name: trace.name,
      annotations: []
    };

    if (trace.parentSpanId !== undefined) {
      restkinTrace.parent_span_id = trace.parentSpanId.toString(16);
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
      callback(null, JSON.stringify(restkinTrace));
    }
  };

  /*** ----- Node-specific, since the thrift relies on Buffers ---- ***/

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
          ipv4: ann.endpoint.ipv4,
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
