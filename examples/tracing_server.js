var express = require('express');

var trace = require('..').trace;
var tracers = require('..').tracers;

tracers.pushTracer(new tracers.DebugTracer(process.stdout));

var app = express();

app.get('/', function(request, response) {
  console.log(request.headers);
  var t = trace.Trace.fromRequest(request.method, request.headers);
  t.record(trace.Annotation.serverRecv());
  t.record(trace.Annotation.string('request_headers',
                                   JSON.stringify(request.headers)));
  response.statusCode = 200;
  response.write('this is the body');
  response.end();
  t.record(trace.Annotation.serverSend());
});

app.listen(8080, 'localhost');
