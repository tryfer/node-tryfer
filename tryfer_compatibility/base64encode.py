"""
Python script that produces base64 and json formats of a trace and a
set of annotations.
"""

from tryfer import formatters
from tryfer.trace import Trace, Annotation

trace = Trace('trace', trace_id=100, span_id=10, parent_span_id=5)
annotations = [Annotation.timestamp('mytime', 1),
               Annotation.string('mystring', 'value')]

print formatters.base64_thrift_formatter(trace, annotations)
print formatters.json_formatter(trace, annotations)
