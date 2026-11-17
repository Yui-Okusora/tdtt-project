"""Exception types shared across the application."""


class ProviderError(Exception):
    """Error raised while talking to an AI provider.

    `retryable` tells the retry loop whether trying again can help
    (rate limits, timeouts, 5xx) or not (bad key, bad request).
    """

    def __init__(self, message, *, retryable=False, status=None, retry_after=None):
        super().__init__(message)
        self.retryable = retryable
        self.status = status
        self.retry_after = retry_after


class ConfigError(ProviderError):
    """Missing / invalid configuration (e.g. no API key)."""

    def __init__(self, message):
        super().__init__(message, retryable=False)


class InvalidResponse(ProviderError):
    """The model answered, but not with usable JSON. Worth retrying."""

    def __init__(self, message):
        super().__init__(message, retryable=True)


class Cancelled(Exception):
    """The user pressed Stop."""
