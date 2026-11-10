import { handleApiRequestWithErrors } from "../services/apiService.js";

export function createApiController({ loadMongoDb, loadAuth, config }) {
  return function apiController(request, response) {
    request.url = request.originalUrl;
    handleApiRequestWithErrors(request, response, {
      loadMongoDb,
      loadAuth,
      loadConfig: () => config,
    }).catch((error) => {
      console.error("TimeCloud API controller failed.", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
      if (!response.headersSent) {
        response.status(500).json({
          error: {
            code: "INTERNAL_ERROR",
            message: "The request could not be completed.",
          },
        });
      }
    });
  };
}
