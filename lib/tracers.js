/**
 * Tracers
 */

(function () {
  var getTracers, pushTracer, setTracers, DebugTracer;

  var globalTracers = [];

  /**
   * Tracer that writes to a stream
   *
   * @param {Stream} destination Stream to write annotations to
   */
  DebugTracer = function (destination) {
    var self = this;
    self.destination = destination;
  };

  /**
   * Writes an annotation and trace
   *
   * @param {Trace} trace Trace to write
   * @param {Annotation} annotation Annotation to write
   */
  DebugTracer.prototype.record = function (trace, annotation) {
    var self = this,
        trace_str = ['traceId', 'parentSpanId', 'spanId', 'name'].map(
                      function (key) { return trace[key]; }
                    ).join(':'),
        annotation_str = annotation.name + " = " + annotation.value + ":" +
                          annotation.annotationType;

    self.destination.write('---\n');
    self.destination.write('Adding annotation for trace: ' + trace_str + '\n');
    self.destination.write('\t' + annotation_str + '\n');
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      DebugTracer: DebugTracer,
      getTracers: function () { return globalTracers; },
      pushTracer: function (tracer) { globalTracers.push(tracer); },
      setTracers: function (tracers) { globalTracers = [].concat(tracers); }
    };
  } else {
    this.DebugTracer = DebugTracer;
    this.getTracers =  getTracers;
    this.pushTracer =  pushTracer;
    this.setTracers =  setTracers;
  }

}());
