/**
 Tracers are responsible for collecting and delivering annotations and traces.

 Traces are expected to be delivered asynchronously and ITracer.record
 is not expected to wait until a Trace has been successfully delivered before
 returning to it's caller.  Given the asynchronous nature of trace delivery any
 errors which occur as a result of attempting to deliver a trace MUST be
 handled by the Tracer.

 A Tracer has a function: record, which records an annotation for the
 specified trace.
 */

(function () {
  var getTracers, pushTracer, setTracers, DebugTracer, EndAnnotationTracer;

  var globalTracers = [];

  has = function(obj, val){
    return Object.hasOwnProperty.call(obj, val);
  };

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
   * Writes an annotation for the specified trace to stdout
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

  /**
   * Tracer that writes to a stream
   *
   * @param {function} sendTraceCallback Callback that takes a {Trace} and an
   *    {Array} of {Annotation}, and sends it to zipkin
   */
  EndAnnotationTracer = function (sendTraceCallback) {
    var self = this;
    self.annotationsForTrace = {};
    self.sendTrace = sendTraceCallback;
  };

  /**
   * Records a trace and annotation, and if the annotation is an end annotation
   * sends it off to zipkin
   *
   * @param {Trace} trace Trace to record
   * @param {Annotation} annotation Annotation to record
   */
  EndAnnotationTracer.prototype.record = function (trace, annotation) {
    var self = this;
    var readyToGo;

    if (!has(self.annotationsForTrace, trace.traceId)) {
      self.annotationsForTrace[trace.traceId] = {};
    }

    if (!has(self.annotationsForTrace[trace.traceId], trace.spanId)) {
      self.annotationsForTrace[trace.traceId][trace.spanId] = [];
    }

    self.annotationsForTrace[trace.traceId][trace.spanId].push(annotation);

    // if it's an end annotation - ship it
    if (annotation.name === zipkinCore_types.CLIENT_RECV ||
        annotation.name === zipkinCore_types.SERVER_SEND) {
      readyToGo = self.annotationsForTrace[trace.traceId][trace.spanId];
      self.annotationsForTrace[trace.traceId][trace.spanId] = [];
      // Should probably log a message with trace and annotations here
      if (self.sendTrace !== undefined) {
        self.sendTrace(trace, readyToGo);
      }
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    zipkinCore_types = require('./_thrift/zipkinCore/zipkinCore_types');
    module.exports = {
      DebugTracer: DebugTracer,
      EndAnnotationTracer: EndAnnotationTracer,
      getTracers: function () { return globalTracers; },
      pushTracer: function (tracer) { globalTracers.push(tracer); },
      setTracers: function (tracers) { globalTracers = [].concat(tracers); }
    };
  } else {
    this.DebugTracer = DebugTracer;
    this.EndAnnotationTracer = EndAnnotationTracer;
    this.getTracers =  getTracers;
    this.pushTracer =  pushTracer;
    this.setTracers =  setTracers;
  }
}());
