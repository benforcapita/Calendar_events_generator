import { defineConfig, type HtmlTagDescriptor } from "vite";
import react from "@vitejs/plugin-react";
import vercel from "./vercel.json";

const productionHeaders = Object.fromEntries(
  vercel.headers.flatMap((group) =>
    group.headers.map((header) => [header.key, header.value]),
  ),
);

const productionCsp = productionHeaders["Content-Security-Policy"];
if (!productionCsp) {
  throw new Error("vercel.json is missing Content-Security-Policy");
}

function withoutDirectives(policy: string, names: readonly string[]): string {
  const skip = new Set(names);
  return policy
    .split(";")
    .map((part) => part.trim())
    .filter((part) => {
      const name = part.split(/\s+/)[0];
      return part.length > 0 && name !== undefined && !skip.has(name);
    })
    .join("; ");
}

// A meta policy ignores frame-ancestors. upgrade-insecure-requests would
// retarget the loopback HTTP preview and browser tests to HTTPS.
const metaCsp = withoutDirectives(productionCsp, [
  "frame-ancestors",
  "upgrade-insecure-requests",
]);
const previewCsp = withoutDirectives(productionCsp, ["upgrade-insecure-requests"]);

export default defineConfig({
  base: "./",
  preview: {
    headers: {
      ...productionHeaders,
      "Content-Security-Policy": previewCsp,
    },
  },
  plugins: [
    react(),
    {
      name: "production-privacy-policy",
      apply: "build",
      transformIndexHtml(): HtmlTagDescriptor[] {
        return [
          {
            tag: "meta",
            attrs: {
              "http-equiv": "Content-Security-Policy",
              content: metaCsp,
            },
            injectTo: "head-prepend",
          },
        ];
      },
    },
  ],
});
