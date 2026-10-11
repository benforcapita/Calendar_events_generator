import { build } from "esbuild";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const samplePath = new URL("../docs/sample-calendar.ics", import.meta.url);
const write = process.argv.includes("--write");
const bundlePath = join(tmpdir(), `calendar-sample-${process.pid}.mjs`);

const built = await build({
  entryPoints: [new URL("../src/domain/sampleCalendar.ts", import.meta.url).pathname],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  logLevel: "silent",
});
writeFileSync(bundlePath, built.outputFiles[0].text);

try {
  const mod = await import(pathToFileURL(bundlePath).href);
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
  unlinkSync(bundlePath);
}
