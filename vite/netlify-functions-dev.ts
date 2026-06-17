import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { loadEnv } from "vite";

function applyLocalEnv(mode: string, root: string) {
  const env = loadEnv(mode, root, "");
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

async function readRequestBody(req: IncomingMessage): Promise<Buffer | undefined> {
  if (req.method === "GET" || req.method === "HEAD") return undefined;

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

function toWebRequest(req: IncomingMessage, body?: Buffer): Request {
  const host = req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/", `http://${host}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((entry) => headers.append(key, entry));
    } else {
      headers.set(key, value);
    }
  }

  return new Request(url, {
    method: req.method,
    headers,
    body: body ? new Uint8Array(body) : undefined,
  });
}

async function sendWebResponse(webResponse: Response, res: ServerResponse) {
  res.statusCode = webResponse.status;
  webResponse.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  const body = Buffer.from(await webResponse.arrayBuffer());
  res.end(body);
}

export function netlifyFunctionsDev(): Plugin {
  let functionsDir = "";

  return {
    name: "netlify-functions-dev",
    configResolved(config) {
      functionsDir = path.resolve(config.root, "netlify/functions");
    },
    configureServer(server) {
      applyLocalEnv(server.config.mode, server.config.root);

      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split("?")[0] ?? "";
        if (!pathname.startsWith("/.netlify/functions/")) {
          next();
          return;
        }

        const name = pathname.slice("/.netlify/functions/".length);
        if (!name || name.includes("/")) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "Function not found" }));
          return;
        }

        const handlerPath = path.join(functionsDir, `${name}.js`);
        try {
          readFileSync(handlerPath);
        } catch {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: `Function not found: ${name}` }));
          return;
        }

        try {
          const mod = await import(`${pathToFileURL(handlerPath).href}?t=${Date.now()}`);
          const handler = mod.default;
          if (typeof handler !== "function") {
            throw new Error(`Function ${name} has no default export`);
          }

          const body = await readRequestBody(req);
          const request = toWebRequest(req, body);
          const response = await handler(request);
          await sendWebResponse(response, res);
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error: error instanceof Error ? error.message : "Function failed",
            }),
          );
        }
      });
    },
  };
}
