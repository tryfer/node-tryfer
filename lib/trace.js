/**
 * Tracers
 */

(function () {
  var _tracers, zipkinCore_types;
  var Trace, Annotation, Endpoint;
  var largestRandom = Math.pow(2, 31) - 1;
  var forEach, has, getUniqueId;

  forEach = function(obj, f){
    Array.prototype.forEach.call(obj, f);
  };

  has = function(obj, val){
    return Object.hasOwnProperty.call(obj, val);
  };

  getUniqueId = function () {
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
  Trace = function(name, options) {
    var self = this;
    self.name = name;

    options = options || {};

    ['traceId', 'spanId', 'parentSpanId'].forEach(function(idName) {
      if (has(options, idName) && options[idName]) {
        self[idName] = options[idName];
      } else if (idName !== 'parentSpanId') {
        self[idName] = getUniqueId();
      }
    });

    if (has(options, 'tracers') && options.tracers){
      self._tracers = options.tracers;
    } else {
      self._tracers = _tracers.getTracers();
    }
  };

  /**
   * Gets a child Trace from this Trace
   *
   * @param {String} name The name of the child tracer
   */
  Trace.prototype.child = function (name) {
    var self = this;
    var optionalArgs = {traceId: self.traceId,
      parentSpanId: self.spanId};
    return new Trace(name, optionalArgs, self._tracers);
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


    forEach(self._tracers, function(value) {
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
  Endpoint = function(ipv4, port, serviceName) {
    this.ipv4 = ipv4;
    this.port = port;
    this.serviceName = serviceName;
  };


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
  Annotation = function(name, value, annotationType, endpoint) {
    var self = this;
    self.name = name;
    self.value = value;
    self.annotationType = annotationType;
    if (endpoint !== undefined) {
      self.endpoint = endpoint;
    }
  };

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

  if (typeof module !== 'undefined' && module.exports) {
    _tracers = require('./tracers');
    zipkinCore_types = require('./_thrift/zipkinCore/zipkinCore_types');
    exports.Trace = Trace;
    exports.Endpoint = Endpoint;
    exports.Annotation = Annotation;
  } else {
    this.Trace = Trace;
    this.Endpoint = Endpoint;
    this.Annotation = Annotation;
  }

}());
