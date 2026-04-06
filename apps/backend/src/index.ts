import { logger } from "./infra/logger.js";
import { startTelemetry } from "./infra/telemetry.js";

const port = Number(process.env["BACKEND_PORT"] ?? 3001);
await startTelemetry();
const { createAppServer } = await import("./app-server.js");
const { server } = await createAppServer();

server.listen(port, () => {
  logger.info("Server listening", { port });
  logger.info("OpenAPI spec ready", { url: `http://localhost:${port}/openapi.json` });
});
