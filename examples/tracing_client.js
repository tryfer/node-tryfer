var request = require('request');

var trace = require('..').trace;
var tracers = require('..').tracers;

var method, uri, t, tget;

if (process.argv.length < 4) {
  console.log("Usage: " +
              process.argv.slice(0, 2).concat(['method', 'uri']).join(" "));
  process.exit(1);
}

method = process.argv[2];
uri = process.argv[3];

t = new trace.Trace('fetch_a_thing');
tracers.pushTracer(new tracers.DebugTracer(process.stdout));

tget = t.child('GET');
tget.record(trace.Annotation.uri(uri));
tget.record(trace.Annotation.clientSend());
request(
  {method: method, uri: uri, headers: tget.toHeaders()},
  function (error, response, body) {
    tget.record(trace.Annotation.clientRecv());
    if (error !== undefined && error !== null) {
      tget.record(trace.Annotation.string(error.toString()));
    } else {
      tget.record(trace.Annotation.string('status_code',
                                          response.statusCode.toString()));
      tget.record(trace.Annotation.string('headers', JSON.stringify(response.headers)));
      tget.record(trace.Annotation.string('body', body));
    }
  });
