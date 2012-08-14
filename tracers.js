/**
 * Tracers
 */

var globalTracers = [];

/**
 * Tracer that writes to a stream
 *
 * @param {Stream} destination Stream to write annotations to
 */
function DebugTracer (destination) {
  self.destination = destination;
}

/**
 * Writes an annotation and trace
 *
 * @param {Trace} trace Trace to write
 * @param {Annotation} annotation Annotation to write
 */
DebugTracer.prototype.record = function (trace, annotation) {
  var trace_str = ['traceId', 'parentSpanId', 'spanId', 'name'].map(
                    function (key) { return trace[key]; }
                  ).join(':'),
      annotation_str = annotation.name + " = " + annotation.value + ":" +
                        annotation.annotationType;

  self.destination.write('---\n');
  self.destination.write('Adding annotation for trace: ' + trace_str + '\n');
  self.destination.write('\t' + annotation_str + '\n');
};

exports.DebugTracer = DebugTracer;
exports.getTracer = function () { return globalTracers; };
exports.pushTracer = function (tracer) { globalTracers.push(tracer); };
exports.setTracer = function (tracers) { globalTracers = tracers; };
