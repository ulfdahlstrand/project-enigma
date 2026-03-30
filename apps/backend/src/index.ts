import { createAppServer } from "./app-server.js";
import { logger } from "./infra/logger.js";

const port = Number(process.env["BACKEND_PORT"] ?? 3001);
const { server } = await createAppServer();

server.listen(port, () => {
  logger.info("Server listening", { port });
  logger.info("OpenAPI spec ready", { url: `http://localhost:${port}/openapi.json` });
});
