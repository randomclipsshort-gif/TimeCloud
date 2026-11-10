export function createHealthController({ loadMongoDb }) {
  return async function healthController(_request, response, next) {
    try {
      const database = await loadMongoDb();
      await database.command({ ping: 1 });
      response.set("Cache-Control", "no-store").json({ status: "ok" });
    } catch (error) {
      next(error);
    }
  };
}
