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


// USAGE: node tracing_client.js [HTTP Method] [URL]
// Sample client code showing how to make an HTTP request to a server that
// supports tracing (one that uses node-tryfer, tryfer, or finagle)

var request = require('request');

var trace = require('..').trace;
var tracers = require('..').tracers;

var method, uri, t;

if (process.argv.length < 4) {
  console.log("Usage: " +
              process.argv.slice(0, 2).concat(['method', 'uri']).join(" "));
  process.exit(1);
}

method = process.argv[2];
uri = process.argv[3];

// DebugTracer prints traces to stdout
tracers.pushTracer(new tracers.DebugTracer(process.stdout));

// The trace used for http requests, by Tryfer convention, should be named by
// the request method
t = new trace.Trace('GET');

// record the URI and send out a CLIENT_SEND annotation before actually making
// the request
t.record(trace.Annotation.uri(uri));
t.record(trace.Annotation.clientSend());

// Make the request after the CLIENT_SEND annotation has been recorded
request(
  {method: method, uri: uri, headers: t.toHeaders()},
  function (error, response, body) {

    // by Tryfer convention, and by what finagle does, a CLIENT_RECV annotation
    // should be made as soon as a response is returned
    t.record(trace.Annotation.clientRecv());

    // Other annotations based on the response can also be made
    if (error !== undefined && error !== null) {
      t.record(trace.Annotation.string(error.toString()));
    } else {
      t.record(trace.Annotation.string('status_code',
                                          response.statusCode.toString()));
      t.record(trace.Annotation.string('headers', JSON.stringify(response.headers)));
      t.record(trace.Annotation.string('body', body));
    }
  });
