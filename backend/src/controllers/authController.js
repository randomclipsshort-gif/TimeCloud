import { toNodeHandler } from "better-auth/node";

export function createAuthController({ loadAuth }) {
  let handlerPromise;
  return async function authController(request, response, next) {
    try {
      if (!handlerPromise) {
        handlerPromise = loadAuth().then((auth) => toNodeHandler(auth));
        handlerPromise.catch(() => {
          handlerPromise = null;
        });
      }
      const handler = await handlerPromise;
      await handler(request, response);
    } catch (error) {
      next(error);
    }
  };
}
