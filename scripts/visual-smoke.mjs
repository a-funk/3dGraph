import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const root = new URL("..", import.meta.url);
const port = Number(process.env.VISUAL_SMOKE_PORT || 5191);
const url = `http://127.0.0.1:${port}/`;
const outDir = process.env.VISUAL_SMOKE_DIR || join(tmpdir(), "3dgraph-visual-smoke");

mkdirSync(outDir, { recursive: true });

const server = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["vite", "examples/json", "--host", "127.0.0.1", "--port", String(port)],
  { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
);

let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += chunk.toString(); });
server.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server is still booting.
    }
    await delay(150);
  }
  throw new Error(`visual smoke server did not start at ${url}\n${serverOutput}`);
}

async function waitForGraph(page) {
  await page.waitForFunction(() => window.graph && document.querySelector("canvas"), null, { timeout: 15_000 });
  await page.waitForFunction(() => window.graph?.model?.nodes?.length > 0, null, { timeout: 15_000 });
}

async function canvasStats(page) {
  return page.evaluate(() => {
    const graph = window.graph;
    graph.renderer.render(graph.scene, graph.camera);
    const gl = graph.renderer.getContext();
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const pixel = new Uint8Array(4);
    const read = (x, y) => {
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return [pixel[0], pixel[1], pixel[2], pixel[3]];
    };
    const background = read(1, 1);
    let nonBackground = 0;
    let samples = 0;
    const cols = 96;
    const rows = 54;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = Math.max(0, Math.min(width - 1, Math.round((col + 0.5) * width / cols)));
        const y = Math.max(0, Math.min(height - 1, Math.round((row + 0.5) * height / rows)));
        const rgba = read(x, y);
        const delta = Math.abs(rgba[0] - background[0])
          + Math.abs(rgba[1] - background[1])
          + Math.abs(rgba[2] - background[2]);
        if (rgba[3] > 0 && delta > 18) nonBackground++;
        samples++;
      }
    }
    return {
      width,
      height,
      samples,
      nonBackground,
      summary: document.getElementById("summary")?.textContent || "",
      title: document.getElementById("panelTitle")?.textContent || "",
    };
  });
}

async function assertRendered(page, label) {
  await waitForGraph(page);
  const stats = await canvasStats(page);
  if (stats.width < 320 || stats.height < 240) {
    throw new Error(`${label}: canvas is too small: ${stats.width}x${stats.height}`);
  }
  if (stats.nonBackground < 3) {
    throw new Error(`${label}: canvas looks blank: ${JSON.stringify(stats)}`);
  }
  if (!stats.summary.includes("visible nodes") || !stats.title) {
    throw new Error(`${label}: detail panel did not render graph state: ${JSON.stringify(stats)}`);
  }
  return stats;
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(url);
  const desktopStats = await assertRendered(page, "desktop");
  await page.screenshot({ path: join(outDir, "desktop.png"), fullPage: false });

  const flight = await page.evaluate(() => {
    const entered = window.graph.flight.enter();
    const active = window.graph.flight.getState().active;
    const exited = window.graph.flight.exit();
    return { entered, active, exited, mode: window.graph.cameraMode };
  });
  if (!flight.entered || !flight.active || !flight.exited || flight.mode !== "orbit") {
    throw new Error(`flight enter/exit failed: ${JSON.stringify(flight)}`);
  }

  const destroyed = await page.evaluate(() => {
    window.graph.destroy();
    return !document.querySelector("#graph canvas");
  });
  if (!destroyed) throw new Error("destroy() left a canvas attached");

  await page.reload();
  await assertRendered(page, "recreated");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const mobileStats = await assertRendered(page, "mobile");
  await page.screenshot({ path: join(outDir, "mobile.png"), fullPage: false });

  console.log(JSON.stringify({ outDir, desktopStats, mobileStats }, null, 2));
} finally {
  await browser?.close?.();
  server.kill("SIGTERM");
}
