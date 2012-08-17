/**
 * Formatters that can be used by tracers
 */

(function () {
  var formatForRestkin;

  /**
   * Formats the trace and annotation to be accepted by RESTkin
   *
   * @param {Trace} trace Trace to format
   * @param {Array} of {Annotation} annotations Annotations to format
   */
  formatForRestkin = function (trace, annotations) {
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

    return JSON.stringify(restkinTrace);
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      formatForRestkin: formatForRestkin
    };
  } else {
    this.formatForRestkin = formatForRestkin;
  }

}());
