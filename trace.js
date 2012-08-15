/**
 * Tracers
 */

var _ = require('underscore');
var _tracers = require('./tracers');
var zipkinCore_types = require('./_thrift/zipkinCore/zipkinCore_types');
var largestRandom  = Math.pow(2, 31) - 1;
debugger;

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
  var self = this;
  self.name = name;

  if (optionalIds === undefined) {
    optionalIds = {};
  }

  _.each(['traceId', 'spanId', 'parentSpanId'], function(idName) {
    if (_.has(optionalIds, idName) && optionalIds[idName]) {
      self[idName] = optionalIds[idName];
    } else {
      self[idName] = getUniqueId();
    }
  });

  this._tracers = tracers === undefined ? _tracers.getTracers() : tracers;
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
  var self = this;
  if (annotation.endpoint === undefined && this.endpoint !== undefined) {
    annotation.endpoint = this.endpoint;
  }

  _.each(this._tracers, function(value) {
    value.record(self, annotation);
  });
};

/**
 * Records an annotation to this Trace
 *
 * @param {Endpoint} endpoint The endpoint of the Trace
 */
Trace.prototype.setEndpoint = function (endpoint) {
  this.endpoint = endpoint;
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
 * An Annotation object
 *
 * @param {String} name The name of the annotation
 * @param {number or String} value The value of the annotation
 * @param {zipkinCore_types.CLIENT_SEND,
 *         zipkinCore_types.CLIENT_RECV,
 *         zipkinCore_types.SERVER_SEND,
 *         zipkinCore_types.CLIENT_RECV,
 *         or String} annotationType
 * @param {Endpoint} endpoint
 */
function Annotation (name, value, annotationType, endpoint) {
  var self = this;
  self.name = name;
  self.value = value;
  self.annotationType = annotationType;
  if (endpoint !== undefined) {
    self.endpoint = endpoint;
  }
}

/**
 * Creates a timestamp annotation
 *
 * @param {String} name The name of the annotation to create
 * @param {number} timestamp Microseconds since the epoch (UTC) - optional
 */
Annotation.timestamp = function (name, timestamp) {
  if (timestamp === undefined) {
    timestamp = Date.now() * 1000;
  }
  return new Annotation(name, timestamp, 'timestamp');
};

/**
 * Creates a client send annotation
 *
 * @param {number} timestamp Microseconds since the epoch (UTC) - optional
 */
Annotation.clientSend = function (timestamp) {
  return Annotation.timestamp(zipkinCore_types.CLIENT_SEND, timestamp);
};

/**
 * Creates a client receive annotation
 *
 * @param {number} timestamp Microseconds since the epoch (UTC) - optional
 */
Annotation.clientRecv = function (timestamp) {
  return Annotation.timestamp(zipkinCore_types.CLIENT_RECV, timestamp);
};

/**
 * Creates a server send annotation
 *
 * @param {number} timestamp Microseconds since the epoch (UTC) - optional
 */
Annotation.serverSend = function (timestamp) {
  return Annotation.timestamp(zipkinCore_types.SERVER_SEND, timestamp);
};

/**
 * Creates a server receive annotation
 *
 * @param {number} timestamp Microseconds since the epoch (UTC) - optional
 */
Annotation.serverRecv = function (timestamp) {
  return Annotation.timestamp(zipkinCore_types.SERVER_RECV, timestamp);
};

/**
 * Creates a unicode string annotation
 *
 * @param {number} timestamp Microseconds since the epoch (UTC) - optional
 */
Annotation.string = function (timestamp) {
  return Annotation.timestamp(zipkinCore_types.SERVER_RECV, timestamp);
};

/**
 * The Python tryfer has one more method: bytes, but as this is hard to do in
 * Javascript, this is left out of the Node.js implementation of tryfer.
 */

exports.Trace = Trace;
exports.Endpoint = Endpoint;
exports.Annotation = Annotation;
module.exports = exports;
