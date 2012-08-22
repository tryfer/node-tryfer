"""
Python script that produces base64 and json formats of a trace and a
set of annotations, so they can be tested in the node port.
"""

from tryfer import formatters
from tryfer.trace import Trace, Endpoint, Annotation

trace = Trace('trace', trace_id=100, span_id=10, parent_span_id=5)
endpoint = Endpoint('1.2.3.4', 8080, 'myservice')
annotations = [Annotation.timestamp('mytime', 1),
               Annotation.string('mystring', 'value')]
for annotation in annotations:
    annotation.endpoint = endpoint

print formatters.base64_thrift_formatter(trace, annotations)
print formatters.json_formatter(trace, annotations)
