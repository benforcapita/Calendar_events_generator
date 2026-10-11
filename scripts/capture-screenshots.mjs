import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium, devices } from "@playwright/test";

const port = 4195;
const base = `http://127.0.0.1:${port}`;
const outDir = new URL("../docs/screenshots/", import.meta.url);

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
  });
}

async function waitForPreview() {
  const started = Date.now();
  while (Date.now() - started < 20000) {
    try {
      const response = await fetch(base);
      if (response.ok) return;
    } catch {
      // Preview is still booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Production preview did not become ready.");
}

async function shot(page, name, fullPage) {
  await page.screenshot({
    path: new URL(name, outDir).pathname,
    fullPage,
    animations: "disabled",
  });
}

const events = {
  version: 1,
  events: [
    {
      id: "design-review",
      uid: "design-review@calendar-events-studio.local",
      title: "Design review",
      description: "Walk through the local-first editor.",
      location: "Studio 2",
      allDay: false,
      start: "2026-10-12T13:00:00Z",
      end: "2026-10-12T14:30:00Z",
      timeZone: "America/New_York",
      createdAt: "2026-10-11T12:00:00Z",
      updatedAt: "2026-10-11T12:00:00Z",
      sequence: 0,
    },
    {
      id: "offsite",
      uid: "offsite@calendar-events-studio.local",
      title: "Offsite",
      description: "",
      location: "",
      allDay: true,
      start: "2026-12-31",
      end: "2027-01-03",
      timeZone: "UTC",
      createdAt: "2026-10-11T12:00:00Z",
      updatedAt: "2026-10-11T12:00:00Z",
      sequence: 0,
    },
  ],
};

await run("npm", ["run", "build"]);
await mkdir(outDir, { recursive: true });
const preview = spawn(
  "node",
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--strictPort",
  ],
  { stdio: "inherit" },
);

try {
  await waitForPreview();
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    chromiumSandbox: true,
  });
  try {
    const desktop = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1,
      locale: "en-US",
      reducedMotion: "reduce",
    });
    const home = await desktop.newPage();
    await home.goto(base);
    await home.getByRole("heading", { name: /Good plans deserve/ }).waitFor();
    await shot(home, "desktop-home.png", true);

    const saved = await desktop.newPage();
    await saved.addInitScript((stored) => {
      localStorage.setItem("ces_events_v1", JSON.stringify(stored));
    }, events);
    await saved.goto(base);
    await saved.getByRole("article", { name: "Design review" }).waitFor();
    await saved.getByRole("article", { name: "Offsite" }).waitFor();
    await shot(saved, "desktop-events.png", true);
    await desktop.close();

    const phone = await browser.newContext({
      ...devices["iPhone 13"],
      deviceScaleFactor: 2,
      locale: "en-US",
      reducedMotion: "reduce",
    });
    const mobile = await phone.newPage();
    await mobile.addInitScript((stored) => {
      localStorage.setItem("ces_events_v1", JSON.stringify(stored));
    }, events);
    await mobile.goto(base);
    await mobile.getByRole("article", { name: "Offsite" }).waitFor();
    await mobile.locator(".collection").evaluate((section) => {
      const top = section.getBoundingClientRect().top + window.scrollY - 12;
      window.scrollTo(0, Math.max(0, top));
    });
    await shot(mobile, "mobile-events.png", false);
    await phone.close();
  } finally {
    await browser.close();
  }
} finally {
  preview.kill("SIGTERM");
}
