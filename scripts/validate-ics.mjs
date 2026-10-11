import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "vite";

const samplePath = new URL("../docs/sample-calendar.ics", import.meta.url);
const write = process.argv.includes("--write");
const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

try {
  const mod = await server.ssrLoadModule("/src/domain/sampleCalendar.ts");
  const text = mod.sampleCalendar();
  const report = mod.validateCalendar(text, mod.sampleEvents());
  if (write) {
    writeFileSync(samplePath, text);
  } else {
    const committed = readFileSync(samplePath, "utf8");
    if (committed !== text) {
      throw new Error(
        "docs/sample-calendar.ics does not match the generator. Run: node scripts/validate-ics.mjs --write",
      );
    }
  }
  console.log(JSON.stringify({ file: "docs/sample-calendar.ics", ...report }, null, 2));
} finally {
  await server.close();
}
