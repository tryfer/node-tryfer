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

var express = require('express');

var trace = require('..').trace;
var tracers = require('..').tracers;

// DebugTracer prints traces to stdout
tracers.pushTracer(new tracers.DebugTracer(process.stdout));

// Create an express server
var app = express();

app.get('/', function(request, response) {
  // Create a trace from the request headers. The trace used for http
  // requests, by Tryfer convention, should be named by the request method
  var t = trace.Trace.fromRequest(request.method, request.headers);

  // Record the server receive annotation
  t.record(trace.Annotation.serverRecv());

  // Other annotations can also be recorded
  t.record(trace.Annotation.string('request_headers',
                                   JSON.stringify(request.headers)));
  response.statusCode = 200;
  response.write('this is the body');
  response.end();

  // By Tryfer convention, and by what finagle does, a SERVER_SEND annotation
  // should be made as soon as a response is sent
  t.record(trace.Annotation.serverSend());
});

app.listen(8080, 'localhost');
