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
  var tracers, formatters, zipkinCore_types;
  var Trace, Annotation, Endpoint;
  var largestRandom = Math.pow(2, 53) - 1;
  var forEach, has, getUniqueId, intOrNone;

  forEach = function(obj, f){
    Array.prototype.forEach.call(obj, f);
  };

  has = function(obj, val){
    return Object.hasOwnProperty.call(obj, val);
  };

  getUniqueId = function () {
    return Math.floor(Math.random() * largestRandom);
  };

  // attempt to parse a hex string into an int - returns none if it's
  // undefined or parsing fails
  intOrNone = function(string) {
    var number = parseInt(string, 16);
    if (isNaN(number)) {
      return undefined;
    } else {
      return number;
    }
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
      self._tracers = tracers.getTracers();
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
    var trace, optionalArgs = {traceId: this.traceId,
                               parentSpanId: this.spanId};
    trace = new Trace(name, optionalArgs, this._tracers);
    trace.setEndpoint(this.endpoint);
    return trace;
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

    forEach(this._tracers, function(tracer) {
      tracer.record([[self, [annotation]]]);
    });
  };

  /**
   * Set a default {Endpoint} for the current {Trace}. All {Annotation}s
   * recorded after this {Endpoint} is set will use it, unless they provide
   * their own {Endpoint}.
   *
   * @param {Endpoint} endpoint The default endpoint for all
   *    {Annotation}s associated with this Trace
   */
  Trace.prototype.setEndpoint = function (endpoint) {
    this.endpoint = endpoint;
  };

  /**
   * Returns a hash of HTTP headers for this trace (to be used for making http
   * requests) to a server that supports tracing
   *
   * These headers are based on the headers used by finagle's tracing
   * http Codec.
   *
   * https://github.com/twitter/finagle/blob/master/finagle-http/
   *
   * Currently not implemented are X-B3-Sampled and X-B3-Flags.
   * Tryfer's underlying Trace implementation has no notion of a Sampled
   * trace, and also does not support flags.
   *
   * @param {Object} headers Optional.  The headers to add tracing headers to.
   *    If not provided, will use a new empty hash.  Either way, will return
   *    said hash.
   */
  Trace.prototype.toHeaders = function (headers) {
    var self = this;
    if (headers === undefined) {
      headers = {};
    }
    headers['X-B3-TraceId'] = formatters._hexStringify(self.traceId);
    headers['X-B3-SpanId'] = formatters._hexStringify(self.spanId);
    if (self.parentSpanId !== undefined) {
      headers['X-B3-ParentSpanId'] = formatters._hexStringify(
        self.parentSpanId);
    }
    return headers;
  };

  /**
   * Creates a new {Trace} given a hash of HTTP headers (to be used when
   * dealing with an incoming http request on a server taht supports tracing).
   *
   * These headers are based on the headers used by finagle's tracing
   * http Codec.
   *
   * Currently not implemented are X-B3-Sampled and X-B3-Flags.
   * Tryfer's underlying Trace implementation has no notion of a Sampled
   * trace, and also does not support flags.
   *
   * ASSUMPTION: header names are all lower cased
   *    The default behavior of the NodeJS http module is to lower-case all
   *    headers.  Express (and it seems most other node http servers) also do
   *    this, so we assume that all the headers are lower case
   *
   * @param {String} traceName What to name the trace - this can't come from
   *    headers - it's highly recommended that this be the request method, to
   *    match with tryfer's naming convention
   * @param {Object} headers A mapping of lower-cased header field names to
   *    values
   */
  Trace.fromHeaders = function(traceName, headers) {
    var traceOptions = {};

    ['X-B3-TraceId', 'X-B3-SpanId', 'X-B3-ParentSpanId'].forEach(function(v) {
      var processed = intOrNone(headers[v.toLowerCase()]);
      if (processed !== undefined) {
        traceOptions[v.slice(5,6).toLowerCase() + v.slice(6)] = processed;
      }
    });

    return new Trace(traceName, traceOptions);
  };

  /**
   * Creates a new {Trace} given a {http.ServerRequest}-like object.
   * Not only does this build a {Trace} based on the headers but sets the
   * server endpoint.  The {http.ServerRequest}-like object should include at
   * least the following:
   *
   * - {request.method} - a {String} of the http method (e.g. GET, POST) -
   *    defaults to GET
   * - {request.headers} - an {Object} containing the http headers - defaults
   *    to an empty object
   * - {request.socket} - an {Object} containing information regarding the
   *    http socket - this is used to determine the server endpoint, which
   *    if socket is undefined will default to an IPv4 address of '127.0.0.1'
   *    and a port of 80
   *
   * For more information on how the {Trace} is constructed from the headers,
   * see {Trace.fromHeaders}
   *
   * @param {Object} request The request object
   * @param {String} serviceName The name of the service) - defaults to 'http'
   */
  Trace.fromRequest = function(request, serviceName) {
    var newTrace = Trace.fromHeaders(
      request.method || 'GET', request.headers || {});

    var host = (request.socket && request.socket.address ?
                request.socket.address() : {address: '127.0.0.1', port: 80});

    if (serviceName === undefined || serviceName === null) {
      serviceName = 'http';
    }

    newTrace.setEndpoint(new Endpoint(host.address, host.port, serviceName));
    return newTrace;
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

  /**
   * Creates a uri annotation for client requests.  This has the Annotation
   * name 'http.uri' because that is the standard set forth in the finagle
   * http Codec.
   *
   * @param {String} uri The URI to annotate
   */
  Annotation.uri = function(uri) {
    return Annotation.string('http.uri', uri);
  };


  if (typeof module !== 'undefined' && module.exports) {
    tracers = require('./tracers');
    formatters = require('./formatters');
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
