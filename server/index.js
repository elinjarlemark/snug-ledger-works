import http from "http";
import { spawn } from "child_process";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const configPath = path.resolve(currentDir, "script-actions.json");

const configPath = path.resolve(process.cwd(), "server/script-actions.json");
const port = process.env.PORT ? Number(process.env.PORT) : 5050;

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
};

const parseRequestBody = (req) =>
  new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
  });

const loadConfig = async () => {
  const raw = await readFile(configPath, "utf-8");
  return JSON.parse(raw);
};

const resolveArgPath = (arg, cwd) => {
  if (arg.startsWith("-") || path.isAbsolute(arg)) {
    return arg;
  }
  return path.resolve(cwd, arg);
};

const runScript = (action, entry) =>
  new Promise((resolve) => {
    const command = entry.command;
    const cwd = entry.cwd ?? currentDir;
    const args = (entry.args ?? []).map((arg) => resolveArgPath(arg, cwd));
const runScript = (action, entry) =>
  new Promise((resolve) => {
    const command = entry.command;
    const args = entry.args ?? [];
    const cwd = entry.cwd ?? process.cwd();
    const env = { ...process.env, ...(entry.env ?? {}) };

    const child = spawn(command, args, { cwd, env });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      resolve({
        action,
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });

    child.on("error", (error) => {
      resolve({
        action,
        code: 1,
        stdout: "",
        stderr: error.message,
      });
    });
  });

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  if (req.method === "POST" && req.url === "/api/scripts/run") {
    let body = {};
    try {
      body = await parseRequestBody(req);
    } catch (error) {
      sendJson(res, 400, {
        success: false,
        message: "Invalid JSON payload.",
      });
      return;
    }

    const action = body?.action;
    if (!action || typeof action !== "string") {
      sendJson(res, 400, {
        success: false,
        message: "Missing action identifier.",
      });
      return;
    }

    let config;
    try {
      config = await loadConfig();
    } catch (error) {
      sendJson(res, 500, {
        success: false,
        message: "Unable to load script configuration.",
      });
      return;
    }

    const entry = config[action];
    if (!entry || !entry.command) {
      sendJson(res, 404, {
        success: false,
        message: `No script configured for action: ${action}.`,
      });
      return;
    }

    const result = await runScript(action, entry);
    if (result.code !== 0) {
      sendJson(res, 500, {
        success: false,
        message: "Script execution failed.",
        data: result,
      });
      return;
    }

    sendJson(res, 200, {
      success: true,
      message: "Script executed successfully.",
      data: result,
    });
    return;
  }

  sendJson(res, 404, { success: false, message: "Not found." });
});

server.listen(port, () => {
  console.log(`Script server listening on port ${port}`);
});
