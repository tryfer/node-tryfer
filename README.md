# node-tryfer: A Node Zipkin Tracer Library

[![Build Status](https://secure.travis-ci.org/racker/node-tryfer.png?branch=master)](http://travis-ci.org/racker/node-tryfer)

Zipkin is a Distributed Tracing system, tryfer is a Python/Twisted client library for Zipkin, and node-tryfer is a port of tryfer.

Tryfer (and by extention node-tryfer) is heavily influenced by Finagle's tracing libraries.

---

## HTTP Tracing examples

To see an example of tracing working in an http client and on an http server, run in one terminal:

```
node examples/tracing_server.js
```

This starts the [express](https://github.com/visionmedia/express) web server, which supports tracing headers from an http client.  For example, run the sample client in another terminal, and get the root page from the express web server:

```
node examples/tracing_client.js GET http://localhost:8080/
```

In the client terminal, you will see a list of all the traces that the client records, which look like this:

    --- Trace ---
    [
      {
        "trace_id": "55bad31800000000",
        "span_id": "6ec7e90a00000000",
        "name": "GET",
        "annotations": [
          {
            "key": "http.uri",
            "value": "http://localhost:8080/",
            "type": "string"
          }
        ]
      }
    ]

There should be a URI annotation, a client send annotation, a client receive annotation, and extra string annotations documentiong aspects of the response from the server.

In the server terminal, you will see a list of all the traces that the server records, which look like this:

    --- Trace ---
    [
      {
        "trace_id": "55bad31800000000",
        "span_id": "6ec7e90a00000000",
        "name": "GET",
        "annotations": [
          {
            "key": "sr",
            "value": 1346194548062000,
            "type": "timestamp",
            "host": {
              "ipv4": "127.0.0.1",
              "port": 8080,
              "service_name": "example-http-server"
            }
          }
        ]
      }
    ]

Note that the trace id and the span id are the same, showing that this is all part of the same trace.  In addition, the server adds its endpoint to the trace (where the server is running).

There should be a server receive annotation, zeor or more string annotations containing information about the request itself, and then a server send annotation.

In both the client and the server example, the debug tracer is used to print out the traces.  Not all tracers do something as soon as `record` is called - some tracers may batch up annotations and/or traces, as opposed to shipping them to zipkin as soon as `record` as called.
