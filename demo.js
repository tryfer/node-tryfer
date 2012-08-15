var tracers = require('./tracers');
var trace = require('./trace');

var sampleTrace, annotation,
    webEndpoint = new trace.Endpoint('10.0.0.1', 80, 'demo-web');

tracers.pushTracer(new tracers.DebugTracer(process.stdout));

sampleTrace = new trace.Trace("getServers");
console.log(sampleTrace.traceId);

sampleTrace.setEndpoint(webEndpoint);
sampleTrace.record(trace.Annotation.clientSend());
sampleTrace.record(trace.Annotation.clientRecv());
