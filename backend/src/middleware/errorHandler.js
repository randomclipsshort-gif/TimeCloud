export function notFoundHandler(_request, response) {
  response.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "API endpoint not found.",
    },
  });
}

export function errorHandler(error, _request, response, _next) {
  if (response.headersSent) return;
  const status =
    Number.isInteger(error?.status) && error.status >= 400 && error.status < 600
      ? error.status
      : 500;
  if (status >= 500) {
    console.error("TimeCloud Express request failed.", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
  }
  response.status(status).json({
    error: {
      code: typeof error?.code === "string" ? error.code : "INTERNAL_ERROR",
      message:
        status >= 500
          ? "The request could not be completed."
          : error instanceof Error
            ? error.message
            : "The request could not be completed.",
    },
  });
}
