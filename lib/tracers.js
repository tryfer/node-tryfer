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
  var formatters;
  var zipkinCore_types;

  var globalTracers = [];

  var has = function(obj, val){
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
   * @param {Array} traces Array of [trace, annotations] tuples.
   */
  DebugTracer.prototype.record = function (traces) {
    var self = this;

    traces.forEach(function(tuple) {
      var trace, annotations;

      trace = tuple[0];
      annotations = tuple[1];

      formatters.formatForRestkin([[trace, annotations]], function(err, json) {
        self.destination.write('--- Trace ---\n');
        // pretty print the json
        self.destination.write(json);
        self.destination.write('\n');
      });
    });
  };

  /**
   * Tracer that writes to a stream
   *
   * @param {function} sendTracesCallback Callback that takes a {Trace} and an
   *    {Array} of {Annotation}, and sends it to zipkin
   */
  EndAnnotationTracer = function (sendTracesCallback) {
    var self = this;
    // keeps track of annotations per span, but since span ID is not
    // guaranteed to be globally unique, tracks span IDs per trace ID
    self.annotationsForSpan = {};
    self.sendTraces = sendTracesCallback;
  };

  /**
   * Records a trace and annotation, and if the annotation is an end annotation
   * sends it off to zipkin
   *
   * @param {Array} traces Array of [trace, annotations] tuples.
   */
  EndAnnotationTracer.prototype.record = function (traces) {
    var self = this;

    traces.forEach(function(tuple) {
      var trace, annotations, readyToGo;

      trace = tuple[0];
      annotations = tuple[1];

      if (!has(self.annotationsForSpan, trace.traceId)) {
        self.annotationsForSpan[trace.traceId] = {};
      }

      if (!has(self.annotationsForSpan[trace.traceId], trace.spanId)) {
        self.annotationsForSpan[trace.traceId][trace.spanId] = [];
      }

      self.annotationsForSpan[trace.traceId][trace.spanId] = self.annotationsForSpan[trace.traceId][trace.spanId].concat(annotations);

      annotations.forEach(function(annotation) {
        // if it's an end annotation - ship it
        if (annotation.name === zipkinCore_types.CLIENT_RECV ||
            annotation.name === zipkinCore_types.SERVER_SEND) {
          readyToGo = self.annotationsForSpan[trace.traceId][trace.spanId];

          delete self.annotationsForSpan[trace.traceId][trace.spanId];

          // Should probably log a message with trace and annotations here
          if (self.sendTraces !== undefined) {
            self.sendTraces([[trace, readyToGo]]);
          }
        }
      });

      if (Object.keys(self.annotationsForSpan[trace.traceId]).length === 0) {
        delete self.annotationsForSpan[trace.traceId];
      }
    });
  };

  if (typeof module !== 'undefined' && module.exports) {
    zipkinCore_types = require('./_thrift/zipkinCore/zipkinCore_types');
    formatters = require('./formatters');
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
