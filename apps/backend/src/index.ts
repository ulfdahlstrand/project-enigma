import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { RPCHandler } from "@orpc/server/node";
import { router } from "./router.js";

const port = Number(process.env["BACKEND_PORT"] ?? 3001);

// RPCHandler adapts oRPC to a plain Node.js http.Server.
// The "/rpc" prefix means procedures are reachable at:
//   POST /rpc/{procedure-name}
const handler = new RPCHandler(router);

const server = createServer(
  (req: IncomingMessage, res: ServerResponse): void => {
    handler
      .handle(req, res, { prefix: "/rpc", context: {} })
      .then(({ matched }) => {
        if (!matched) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Not Found" }));
        }
      })
      .catch((err: unknown) => {
        console.error("[backend] unhandled error:", err);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal Server Error" }));
        }
      });
  }
);

server.listen(port, () => {
  console.log(`[backend] Server listening on port ${port}`);
});
