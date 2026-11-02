import logging
import re

SSN_RE = re.compile(r"\b\d{3}-?\d{2}-?\d{4}\b")
EIN_RE = re.compile(r"\b\d{2}-\d{7}\b")


class ScrubPiiFilter(logging.Filter):
    """Replace anything that looks like an SSN or EIN before a log line is written."""

    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        scrubbed = EIN_RE.sub("[EIN]", SSN_RE.sub("[SSN]", message))
        if scrubbed != message:
            record.msg, record.args = scrubbed, None
        return True
