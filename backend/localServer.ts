/**
 * Local HTTP Development & Testing Server
 * 
 * Emulates AWS API Gateway + Lambda locally without external emulator binaries.
 * Uses native Node.js http module.
 */

import http from "node:http";
import { handler } from "./lambda";
import type { APIGatewayProxyEvent } from "aws-lambda";

const PORT = Number(process.env.API_PORT || process.env.LOCAL_API_PORT || 3001);

export function createLocalServer(): http.Server {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const method = req.method || "GET";
    const path = url.pathname;

    const queryParams: Record<string, string> = {};
    url.searchParams.forEach((val, key) => {
      queryParams[key] = val;
    });

    let bodyString = "";
    req.on("data", (chunk) => {
      bodyString += chunk;
    });

    req.on("end", async () => {
      // Synthesize APIGatewayProxyEvent (REST API format)
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: method,
        path,
        queryStringParameters: Object.keys(queryParams).length > 0 ? queryParams : null,
        headers: req.headers as Record<string, string>,
        body: bodyString.length > 0 ? bodyString : null,
        isBase64Encoded: false,
      };

      try {
        const result = await handler(event as APIGatewayProxyEvent);
        const statusCode = result.statusCode || 200;
        const headers = (result.headers || {}) as Record<string, string>;

        Object.entries(headers).forEach(([k, v]) => {
          res.setHeader(k, v);
        });

        res.statusCode = statusCode;
        res.end(result.body || "");
      } catch (err) {
        console.error("[Local Server Exception]", err);
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Local Server Error", details: String(err) }));
      }
    });
  });
}

// Auto-run if invoked directly via CLI
if (process.argv[1]?.endsWith("localServer.ts")) {
  process.env.USE_LOCAL_MOCK_DB = process.env.USE_LOCAL_MOCK_DB || "true";
  const server = createLocalServer();
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 Local AWS API Gateway emulator running at: http://localhost:${PORT}`);
    console.log(`Routes:`);
    console.log(`  - POST http://localhost:${PORT}/analyze`);
    console.log(`  - GET  http://localhost:${PORT}/history`);
    console.log(`  - GET  http://localhost:${PORT}/health`);
    console.log(`Press Ctrl+C to stop.\n`);
  });
}
