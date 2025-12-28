import { execSync, spawn } from "child_process";
import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

// ES Module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

const PORT = 3001;

// --- HTTP Server (Static Files + Trigger) ---
const server = http.createServer((req, res) => {
  // 1. CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // 2. Trigger Endpoint
  if (req.method === "POST" && req.url === "/trigger-deep-search") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { query, slug } = JSON.parse(body);
        console.log(
          `[Local Runner] Triggered Search: "${query}" (slug: ${slug})`
        );

        // Start the Action via ACT
        startActDeepSearch(query, slug);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: true,
            message: "Local Deep Search started via Act",
          })
        );
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // 2b. Cleanup Endpoint
  if (req.method === "POST" && req.url === "/cleanup") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { slug, keepFiles } = JSON.parse(body);
        console.log(
          `[Local Runner] Cleanup requested for "${slug}". Keeping:`,
          keepFiles
        );

        const targetDir = path.join(PROJECT_ROOT, "output", slug);
        if (!fs.existsSync(targetDir)) {
          throw new Error("Target directory not found");
        }

        // Recursively or flat? Usually flat for now based on previous simple structure.
        // But files might be deep. Let's assume flat for simplicity or use recursive crawl if needed.
        // We will just read the directory.
        // NOTE: If keepFiles has relative paths like "output/slug/file.pdf", we need to normalize.

        const allFiles = fs.readdirSync(targetDir);
        let deletedCount = 0;

        allFiles.forEach((file) => {
          // Basic normalization: Check if 'file' or 'slug/file' is in keepFiles?
          // The frontend will likely send full paths or filenames.
          // Let's assume frontend sends just filenames for simplicity OR we check containment.

          // Better approach: keepFiles contains full local paths or URLs.
          // We'll check if the file name appears in any of the keepFiles strings.

          const isKept = keepFiles.some((k) => k.endsWith(file));

          if (!isKept && file !== "manifest.json" && file !== "index.md") {
            // We keep manifest/index generally for history, or we delete? User said delete unused.
            // Let's delete everything not explicitly kept.
            const filePath = path.join(targetDir, file);

            // Check if directory (recurse not implemented, just skip dir)
            if (fs.lstatSync(filePath).isDirectory()) return;

            fs.unlinkSync(filePath);
            console.log(`[Local Runner] Deleted: ${file}`);
            deletedCount++;
          }
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, deleted: deletedCount }));
      } catch (e) {
        console.error("Cleanup Error:", e);
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // 3. Static File Serving (Output Directory)
  if (
    (req.method === "GET" || req.method === "HEAD") &&
    req.url.startsWith("/output/")
  ) {
    const requestUrlPath = decodeURIComponent(req.url.split("?")[0]); // Remove query params
    const filePath = path.join(PROJECT_ROOT, requestUrlPath);

    // Normalize paths for valid comparison (fixes Windows c:/C: issues)
    const normalizedFilePath = path.normalize(filePath).toLowerCase();
    const normalizedOutputDir = path
      .normalize(path.join(PROJECT_ROOT, "output"))
      .toLowerCase();

    console.log(`[Local Runner] Serving request (${req.method}): ${req.url}`);

    // Security check: prevent ../ directory traversal
    if (!normalizedFilePath.startsWith(normalizedOutputDir)) {
      console.error(
        `[Local Runner] Access Denied: ${normalizedFilePath} is not inside ${normalizedOutputDir}`
      );
      res.writeHead(403);
      res.end("Access Denied");
      return;
    }

    if (!fs.existsSync(filePath)) {
      console.warn(`[Local Runner] File not found: ${filePath}`);
      res.writeHead(404);
      res.end("File not found");
      return;
    }

    // Optimization: If HEAD, just stat the file for headers
    if (req.method === "HEAD") {
      fs.stat(filePath, (err, stats) => {
        if (err) {
          res.writeHead(500);
          res.end();
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        let contentType = "application/octet-stream";
        if (ext === ".json") contentType = "application/json; charset=utf-8";
        if (ext === ".pdf") contentType = "application/pdf";
        if (ext === ".txt") contentType = "text/plain; charset=utf-8";
        if (ext === ".md") contentType = "text/markdown; charset=utf-8";
        if (ext === ".html") contentType = "text/html; charset=utf-8";
        if (ext === ".png") contentType = "image/png";
        if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";

        res.writeHead(200, {
          "Content-Type": contentType,
          "Content-Length": stats.size,
        });
        res.end();
      });
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        console.error(`[Local Runner] Error reading file: ${err.message}`);
        res.writeHead(500);
        res.end("Error reading file");
        return;
      }
      // Basic mime types
      const ext = path.extname(filePath).toLowerCase();
      let contentType = "application/octet-stream";
      if (ext === ".json") contentType = "application/json; charset=utf-8";
      if (ext === ".pdf") contentType = "application/pdf";
      if (ext === ".txt") contentType = "text/plain; charset=utf-8";
      if (ext === ".md") contentType = "text/markdown; charset=utf-8";
      if (ext === ".html") contentType = "text/html; charset=utf-8";
      if (ext === ".png") contentType = "image/png";
      if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";

      res.writeHead(200, { "Content-Type": contentType });
      res.end(data);
    });
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

// --- WebSocket Server (Log Streaming) ---
const wss = new WebSocketServer({ server });

let currentClients = [];

wss.on("connection", (ws) => {
  console.log("[Local Runner] Client connected to WebSocket");
  currentClients.push(ws);

  ws.send(
    JSON.stringify({ type: "info", text: "Connected to Local Runner Console" })
  );

  ws.on("close", () => {
    currentClients = currentClients.filter((c) => c !== ws);
  });
});

function broadcast(msg) {
  currentClients.forEach((client) => {
    if (client.readyState === 1) {
      // OPEN
      client.send(JSON.stringify(msg));
    }
  });
}

// --- Act Execution Logic ---
// --- Act Execution Logic ---
function startActDeepSearch(query, slug) {
  // Construct event payload for repository_dispatch
  const eventPayload = {
    action: "deep-search",
    client_payload: {
      query: query,
      slug: slug,
      ntfy_topic: "", // Local text uses WS, not ntfy
    },
  };

  const eventPath = path.join(PROJECT_ROOT, "event.json");
  fs.writeFileSync(eventPath, JSON.stringify(eventPayload, null, 2));

  broadcast({
    type: "info",
    text: `STARTING ACT (Local Deep Search) for "${query}"...`,
  });

  // Spawn 'act' command
  // Note: User must have act installed.
  // We assume secrets are in .secrets file or environment.
  // Argument --secret-file .secrets is common practice.
  const act = spawn(
    "act",
    [
      "repository_dispatch",
      "-e",
      "event.json",
      "--container-architecture",
      "linux/amd64", // Force arch if needed
      "--artifact-server-path", // Enable artifact server
      path.join(PROJECT_ROOT, "act-artifacts"),
      "-W",
      ".github/workflows/deep-search.yml", // Specific workflow
    ],
    {
      cwd: PROJECT_ROOT,
      shell: true,
    }
  );

  act.stdout.on("data", (data) => {
    const lines = data.toString().split("\n");
    lines.forEach((line) => {
      if (line.trim()) broadcast({ type: "log", text: line.trim() });
    });
  });

  act.stderr.on("data", (data) => {
    const lines = data.toString().split("\n");
    lines.forEach((line) => {
      // Act often prints progress/info to stderr, so treat as log or warning
      if (line.trim()) broadcast({ type: "log", text: line.trim() });
    });
  });

  act.on("close", (code) => {
    console.log(`[Local Runner] Act process exited with code ${code}`);
    if (code === 0) {
      broadcast({ type: "info", text: "Act finished successfully." });

      // Move artifacts to output folder
      try {
        // Check act-artifacts content to find the run ID folder
        const artifactsBaseDir = path.join(PROJECT_ROOT, "act-artifacts");
        let foundArtifactPath = null;

        if (fs.existsSync(artifactsBaseDir)) {
          const runs = fs.readdirSync(artifactsBaseDir);
          // Assuming the latest numeric folder is the one (or just the first one if clean)
          // act creates "1", "2" etc.
          for (const runDir of runs) {
            const potentialPath = path.join(
              artifactsBaseDir,
              runDir,
              "deep-search-artifact"
            );
            if (fs.existsSync(potentialPath)) {
              foundArtifactPath = potentialPath;
              break;
            }
          }
        }

        const outputSlug = slug || "latest"; // Fallback if slug missing
        const outputPath = path.join(PROJECT_ROOT, "output", outputSlug);

        if (foundArtifactPath) {
          console.log(
            `[Local Runner] Moving artifacts from ${foundArtifactPath} to ${outputPath}`
          );

          // Ensure output dir exists (it might not if act didn't mount it effectively)
          fs.mkdirSync(outputPath, { recursive: true });

          // Inspect what was found
          if (fs.lstatSync(foundArtifactPath).isDirectory()) {
            // Check if it contains a zip file (common with act/upload-artifact@v4)
            const filesInArtifact = fs.readdirSync(foundArtifactPath);
            const zipFile = filesInArtifact.find((f) => f.endsWith(".zip"));

            if (zipFile) {
              console.log(
                `[Local Runner] Found ZIP in artifact: ${zipFile}. Extracting...`
              );
              const zipPath = path.join(foundArtifactPath, zipFile);

              // Ensure output dir
              fs.mkdirSync(outputPath, { recursive: true });

              // Try tar first (cross-platformish), fallback to copy if fail?
              // Windows 10+ has tar.
              try {
                // tar -xf source -C dest
                // Note: tar on windows might need absolute paths or careful handling.
                // Quoting paths is important.
                execSync(`tar -xf "${zipPath}" -C "${outputPath}"`);
                console.log("[Local Runner] Extraction successful (tar).");
              } catch (tarErr) {
                console.log(
                  "[Local Runner] Tar failed, trying Powershell Expand-Archive..."
                );
                try {
                  execSync(
                    `powershell -command "Expand-Archive -Force '${zipPath}' '${outputPath}'"`
                  );
                  console.log(
                    "[Local Runner] Extraction successful (powershell)."
                  );
                } catch (psErr) {
                  console.error(
                    "[Local Runner] All extraction methods failed.",
                    psErr
                  );
                  // Fallback: just copy the zip so user can at least see it
                  fs.cpSync(zipPath, path.join(outputPath, zipFile));
                }
              }
            } else {
              // Determine if it's a directory with files?
              // Just copy recursively
              console.log(
                "[Local Runner] No zip found, copying directory contents..."
              );
              fs.cpSync(foundArtifactPath, outputPath, {
                recursive: true,
                force: true,
              });
            }
          } else {
            // It's a file?
            fs.cpSync(foundArtifactPath, outputPath, {
              recursive: true,
              force: true,
            });
          }

          broadcast({
            type: "info",
            text: "Files synchronized (and extracted if needed) to local output.",
          });

          // Clean up artifact temp dir if you want
          fs.rmSync(foundArtifactPath, { recursive: true, force: true });
        } else {
          broadcast({
            type: "warning",
            text: "Artifact not found. Files might be missing.",
          });
        }

        // --- Post-Processing: Sanitize Manifest ---
        const manifestPath = path.join(outputPath, "manifest.json");
        if (fs.existsSync(manifestPath)) {
          try {
            let content = fs.readFileSync(manifestPath, "utf-8");
            try {
              JSON.parse(content);
            } catch (e) {
              console.log(
                "[Local Runner] Manifest JSON is invalid, attempting repair..."
              );
              // Attempt to extract the first valid JSON array
              const firstOpen = content.indexOf("[");
              if (firstOpen !== -1) {
                let stack = 0;
                let lastClose = -1;
                for (let i = firstOpen; i < content.length; i++) {
                  if (content[i] === "[") stack++;
                  if (content[i] === "]") {
                    stack--;
                    if (stack === 0) {
                      lastClose = i;
                      break;
                    }
                  }
                }

                if (lastClose !== -1) {
                  const candidate = content.substring(firstOpen, lastClose + 1);
                  try {
                    const parsed = JSON.parse(candidate);
                    fs.writeFileSync(
                      manifestPath,
                      JSON.stringify(parsed, null, 2)
                    );
                    console.log(
                      "[Local Runner] Manifest repaired successfully."
                    );
                  } catch (pe) {
                    console.error(
                      "[Local Runner] Repair failed JSON parse:",
                      pe.message
                    );
                  }
                } else {
                  console.error(
                    "[Local Runner] Could not find matching closing bracket."
                  );
                }
              }
            }
          } catch (err) {
            console.error(
              "[Local Runner] Error sanitizing manifest:",
              err.message
            );
          }
        }
      } catch (err) {
        console.error("Error moving artifacts:", err);
        broadcast({
          type: "error",
          text: `Failed to move artifacts: ${err.message}`,
        });
      }

      broadcast({ type: "complete", slug: slug });
    } else {
      broadcast({ type: "error", text: `Act failed with exit code ${code}` });
    }
    // Cleanup event file
    // try { fs.unlinkSync(eventPath); } catch(e) {}
  });
}

server.listen(PORT, () => {
  console.log(`[Local Runner] Server running at http://localhost:${PORT}`);
  console.log(`[Local Runner] WebSocket ready.`);
});
