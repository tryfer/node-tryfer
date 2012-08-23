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

(function () {
  var _tracers, zipkinCore_types;
  var Trace, Annotation, Endpoint;
  var largestRandom = Math.pow(2, 63) - 1;
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
   * A Trace encapsulates information about the current span of this trace
   * and provides a mechanism for creating new child spans and recording
   * annotations for this span. It delegates to zero or more {Tracers} and
   * allows setting a default {Endpoint} to associate with {Annotation}s
   *
   * @param {String} name A string describing this span
   * @param {Hash} optionalIds A hash any or all or none of the following
   *    params, for which values will be generated if not provided:
   *
   *    @param {Number} traceId 64-bit integer identifying this trace
   *    @param {Number} spanId 64-bit integer identifying this span
   *    @param {Number} parentSpanId 64-bit integer identifying this trace's
   *        parent span, or undefined.
   *    @param {Array} _tracers Zero or more {Tracers}
   */
  Trace = function(name, options) {
    var self = this;
    self.name = name;

    options = options || {};

    ['traceId', 'spanId', 'parentSpanId'].forEach(function(idName) {
      if (has(options, idName) && options[idName] !== null &&
          options[idName] !== undefined) {
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
   * Create a new instance of this class derived from the current instance
   * such that:
   *    child.trace_id == current.trace_id, and
   *    child.parent_span_id == current.span_id
   * The child {Trace} will have a new unique {spanId} and if set, the
   * endpoint of the current {Trace} object.
   *
   * @param {String} name The name describing the new span represented by the
   *    new child {Trace} object.
   */
  Trace.prototype.child = function (name) {
    var self = this;
    var optionalArgs = {traceId: self.traceId,
      parentSpanId: self.spanId};
    return new Trace(name, optionalArgs, self._tracers);
  };

  /**
   * Record an annotation for this {Trace}.  This is the primary entry point
   * for associating {Annotation}s with {Trace}s.  It will delegate actual
   * recording to zero or more {Tracer}s.
   *
   * @param {Annotation} annotation The annotation to associate
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
   * Set a default {Endpoint} for the current {Trace}. All {Annotation}s
   * recorded after this {Endpoint} is set will use it, unless they provide
   * their own {Endpoint}.
   *
   * @param: {Endpoint} endpoint The default endpoint for all
   *    {Annotation}s associated with this Trace
   */
  Trace.prototype.setEndpoint = function (endpoint) {
    this.endpoint = endpoint;
  };



  /**
   * An IEndpoint represents a source of annotations in a distributed system.
   *
   * An endpoint represents the place where an event represented by an
   * annotation occurs.
   *
   * In a simple client/server RPC system both the client and server will
   * record Annotations for the same trace & span but those annotations will
   * have separate endpoints.  On the client the endpoint will represent the
   * client service and on the server the endpoint will represent server
   * service.
   *
   * @param {String} ipv4 Dotted decimal string IP Address of this {Endpoint}
   * @param {number} port Integer port of this {Endpoint}
   * @param {String} service_name Name of the service for this {Endpoint}
   */
  Endpoint = function(ipv4, port, serviceName) {
    this.ipv4 = ipv4;
    this.port = port;
    this.serviceName = serviceName;
  };


  /**
   * An annotation represents a piece of information attached to a trace.
   *
   * Most commonly this will be an event like:
   *    * Client send
   *    * Server receive
   *    * Server send
   *    * Client receive
   *
   * It may however also include non-event information such as the URI of
   * an HTTP request being made, or the user id that initiated the action
   * which caused the operations being traced to be performed.
   *
   * @param {String} name The name of this annotation
   * @param {number or String} value The value of this annotation
   * @param {String} annotationType A string describing the type of this
   *    annotation.  Should be one of:
   *      {zipkinCore_types.CLIENT_SEND},
   *      {zipkinCore_types.CLIENT_RECV},
   *      {zipkinCore_types.SERVER_SEND},
   *         zipkinCore_types.CLIENT_RECV,
   *         or String} annotationType
   * @param {Endpoint} endpoint
   *
   * NOTE: If the annotationType is NOT a timestamp, the value must be a string
   * (for now)
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
   * Creates a timestamp annotation, which represents an event.
   *
   * @param {String} name The name of this timestamp
   * @param {number} timestamp The time of the event in microseconds since the
   *    epoch (UTC) - optional
   */
  Annotation.timestamp = function (name, timestamp) {
    if (timestamp === undefined) {
      timestamp = Date.now() * 1000;
    }
    return new Annotation(name, timestamp, 'timestamp');
  };

  /**
   * Creates a client send (timestamp) annotation
   *
   * @param {number} timestamp The time of the client send event in
   *    microseconds since the epoch (UTC) - optional
   */
  Annotation.clientSend = function (timestamp) {
    return Annotation.timestamp(zipkinCore_types.CLIENT_SEND, timestamp);
  };

  /**
   * Creates a client receive (timestamp) annotation
   *
   * @param {number} timestamp The time of the client receive event in
   *    microseconds since the epoch (UTC) - optional
   */
  Annotation.clientRecv = function (timestamp) {
    return Annotation.timestamp(zipkinCore_types.CLIENT_RECV, timestamp);
  };

  /**
   * Creates a server send (timestamp) annotation
   *
   * @param {number} timestamp The time of the server send event in
   *    microseconds since the epoch (UTC) - optional
   */
  Annotation.serverSend = function (timestamp) {
    return Annotation.timestamp(zipkinCore_types.SERVER_SEND, timestamp);
  };

  /**
   * Creates a server receive (timestamp) annotation
   *
   * @param {number} timestamp The time of the server receive event in
   *    microseconds since the epoch (UTC) - optional
   */
  Annotation.serverRecv = function (timestamp) {
    return Annotation.timestamp(zipkinCore_types.SERVER_RECV, timestamp);
  };

  /**
   * Creates a unicode string (non-event) annotation
   *
   * @param {String} name The name of this string annotation
   * @param {String} value The string value of the annotation
   */
  Annotation.string = function (name, value) {
    return new Annotation(name, value, 'string');
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
