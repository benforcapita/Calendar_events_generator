import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";

const vercel = JSON.parse(
  readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
);
const configured = Object.fromEntries(
  vercel.headers.flatMap((group) =>
    group.headers.map((header) => [header.key, header.value]),
  ),
);
const headers = Object.fromEntries(
  Object.entries(configured).map(([key, value]) => [key.toLowerCase(), value]),
);

const failures = [];

function directiveMap(policy) {
  return Object.fromEntries(
    policy
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...rest] = part.split(/\s+/);
        return [name, rest];
      }),
  );
}

function sources(directives, name) {
  return directives[name] ?? [];
}

function has(directives, name, token) {
  return sources(directives, name).includes(token);
}

const csp = headers["content-security-policy"] ?? "";
const directives = directiveMap(csp);
const hsts = headers["strict-transport-security"] ?? "";
const maxAge = Number(hsts.match(/max-age=(\d+)/)?.[1] ?? 0);
const referrer = headers["referrer-policy"] ?? "";
const acceptedReferrer = new Set([
  "no-referrer",
  "same-origin",
  "strict-origin",
  "strict-origin-when-cross-origin",
]);

if (!csp) failures.push("Content-Security-Policy is missing");
if (!sources(directives, "default-src").length) {
  failures.push("CSP default-src is missing");
}
for (const blocked of ["*", "'unsafe-inline'", "'unsafe-eval'", "data:", "http:", "https:"]) {
  if (sources(directives, "default-src").includes(blocked)) {
    failures.push(`CSP default-src allows ${blocked}`);
  }
  if (sources(directives, "script-src").includes(blocked)) {
    failures.push(`CSP script-src allows ${blocked}`);
  }
}
if (!has(directives, "script-src", "'self'")) {
  failures.push("CSP script-src must allow 'self'");
}
if (!has(directives, "script-src-attr", "'none'")) {
  failures.push("CSP script-src-attr must be 'none'");
}
if (!has(directives, "style-src", "'self'")) {
  failures.push("CSP style-src must allow 'self'");
}
if (sources(directives, "style-src").includes("'unsafe-inline'")) {
  failures.push("CSP style-src allows 'unsafe-inline'");
}
if (!has(directives, "style-src-attr", "'none'")) {
  failures.push("CSP style-src-attr must be 'none'");
}
for (const name of [
  "object-src",
  "base-uri",
  "frame-ancestors",
  "frame-src",
  "worker-src",
  "connect-src",
  "font-src",
  "manifest-src",
]) {
  if (!has(directives, name, "'none'")) failures.push(`CSP ${name} must be 'none'`);
}
if (!Object.hasOwn(directives, "form-action") || !has(directives, "form-action", "'none'")) {
  failures.push("CSP form-action must be 'none'");
}
if (!csp.includes("upgrade-insecure-requests")) {
  failures.push("CSP is missing upgrade-insecure-requests");
}

if (maxAge < 15552000) {
  failures.push(`HSTS max-age ${maxAge} is below 15552000 seconds`);
}
if (!/includeSubDomains/i.test(hsts)) {
  failures.push("HSTS is missing includeSubDomains");
}
if (headers["x-content-type-options"] !== "nosniff") {
  failures.push("X-Content-Type-Options must be nosniff");
}
if (headers["x-frame-options"] !== "DENY") {
  failures.push("X-Frame-Options must be DENY");
}
if (!acceptedReferrer.has(referrer)) {
  failures.push(`Referrer-Policy ${referrer || "(missing)"} is not an accepted strict policy`);
}
if (!headers["permissions-policy"]?.includes("=()")) {
  failures.push("Permissions-Policy must deny unused features");
}
if (headers["cross-origin-opener-policy"] !== "same-origin") {
  failures.push("Cross-Origin-Opener-Policy must be same-origin");
}
if (headers["cross-origin-embedder-policy"] !== "require-corp") {
  failures.push("Cross-Origin-Embedder-Policy must be require-corp");
}
if (headers["cross-origin-resource-policy"] !== "same-origin") {
  failures.push("Cross-Origin-Resource-Policy must be same-origin");
}
for (const retired of ["x-xss-protection", "public-key-pins", "expect-ct"]) {
  if (headers[retired] !== undefined) {
    failures.push(`${retired} is retired and must stay unset`);
  }
}

const builtPage = new URL("../dist/index.html", import.meta.url);
const expectedMeta = csp
  .split(";")
  .map((part) => part.trim())
  .filter((part) => {
    const name = part.split(/\s+/)[0];
    return part && name !== "frame-ancestors" && name !== "upgrade-insecure-requests";
  })
  .join("; ");
if (!existsSync(builtPage)) {
  failures.push("dist/index.html is missing. Run npm run build before check:headers.");
} else {
  const html = readFileSync(builtPage, "utf8");
  const meta = html.match(/<meta\b[^>]*http-equiv="Content-Security-Policy"[^>]*>/i);
  const content = meta?.[0]
    .match(/\bcontent="([^"]*)"/)?.[1]
    ?.replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
  if (content !== expectedMeta) {
    failures.push("Built meta Content-Security-Policy does not match vercel.json fetch directives");
  }
}

const server = createServer((_req, res) => {
  for (const [key, value] of Object.entries(configured)) res.setHeader(key, value);
  res.statusCode = 200;
  res.end("ok");
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const port = typeof address === "object" && address ? address.port : 0;
try {
  const response = await fetch(`http://127.0.0.1:${port}/`);
  for (const [key, value] of Object.entries(configured)) {
    if (response.headers.get(key) !== value) {
      failures.push(`Local response dropped or changed ${key}`);
    }
  }
} finally {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

const preload = /(?:^|;\s*)preload(?:\s*;|$)/i.test(hsts);
if (preload) {
  failures.push("HSTS preload is set, but this repository has no production hostname to submit");
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log("Local securityheaders.com rubric: pass");
console.log("Expected grade if these headers are served over HTTPS: A");
console.log("securityheaders.com grade: unverified");
console.log("HSTS: max-age=63072000; includeSubDomains (preload omitted; no production hostname)");
console.log("Served the vercel.json header set on loopback and read the same values back.");
console.log("Built meta CSP matches the fetch directives, without frame-ancestors or upgrade-insecure-requests.");
