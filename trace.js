/**
 * Tracers
 */

var tracer = require('tracer');

var largestRandom  = Math.pow(2, 31) - 1;

var getUniqueId = function () {
  return Math.floor(Math.random() * largestRandom);
};

/**
 * A Trace object to pass around
 *
 * @param {String} name The name of the trace
 * @param {Hash} optionalIds A hash any or all or none of the following params,
 *    for which values will be generated if not provided:
 *    traceId {number} The unique id of the trace
 *    spanId {number} The unique id of the span
 *    parentSpanId {number} The unique id of the parent span
 * @param {Array} tracers An array of tracers
 */
function Trace (name, optionalIds, tracers) {
  var idName;
  this.name = name;

  if (optionalIds === undefined) {
    optionalIds = {};
  }

  for (idName in ['traceId', 'spanId', 'parentSpanId']) {
    if (idName in optionalIds && optionalIds[idName]) {
      this[idName] = optionalIds[idName];
    } else {
      this[idName] = getUniqueId();
    }
  }

  this._tracers = tracers === undefined ? tracer.getTracers() : tracers;
}

/**
 * Gets a child Trace from this Trace
 *
 * @param {String} name The name of the child tracer
 */
Trace.prototype.child = function (name) {
  var optionalArgs = {traceId: this.traceId, parentSpanId:self.parentSpanId};
  return new Trace(name, optionalArgs, this._tracers);
};

/**
 * Records an annotation to this Trace
 *
 * @param {Annotation} annotation The annotation to record
 */
Trace.prototype.record = function (annotation) {
  var tracer;

  if (annotation.endpoint === undefined && this.endpoint !== undefined) {
    annotation.endpoint = this.endpoint;
  }

  for (tracer in this._tracers) {
    tracer.record(annotation);
  }
};


/**
 * An Endpoint object - the endpoint where the Trace/Annotation is happening
 *
 * @param {String} ipv4 The IPv4 address
 * @param {number} port The port of the service
 * @param {String} service_name the name of the service where the
 *    Trace/Annotation is happening
 */
function Endpoint (ipv4, port, serviceName) {
  this.ipv4 = ipv4;
  this.port = port;
  this.serviceName = serviceName;
}


/**
 * An Endpoint object - the endpoint where the Trace/Annotation is happening
 *
 * @param {String} ipv4 The IPv4 address
 * @param {number} port The port of the service
 * @param {String} service_name the name of the service where the
 *    Trace/Annotation is happening
 */
function Endpoint (ipv4, port, serviceName) {
  this.ipv4 = ipv4;
  this.port = port;
  this.serviceName = serviceName;
}
