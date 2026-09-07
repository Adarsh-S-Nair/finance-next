import { readFile, readdir, stat } from "node:fs/promises";
import assert from "node:assert/strict";
const root = new URL("./public/", import.meta.url);
const expected = ["index.html", "privacy.html", "terms.html", "404.html", "styles.css", "channel-logo.png"];
assert.deepEqual((await readdir(root)).sort(), expected.sort(), "Only approved public files may be deployed");
for (const name of expected) assert.ok((await stat(new URL(name, root))).size > 0);
for (const name of expected.filter(name => name.endsWith(".html"))) {
  const html = await readFile(new URL(name, root), "utf8");
  assert.ok(html.includes('name="viewport"'));
  assert.ok(html.includes('<html lang="en">'));
  assert.ok(!/tail950467|100\\.108\\.69\\.20|client_secret|refresh_token/.test(html), "Do not expose private infrastructure or credentials");
  for (const [, path] of html.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
    const file = path === "/" ? "index.html" : path.slice(1) + (path.includes(".") ? "" : ".html");
    await stat(new URL(file, root));
  }
}
const privacy = await readFile(new URL("privacy.html", root), "utf8");
assert.ok(privacy.includes("https://policies.google.com/privacy"));
assert.ok(privacy.includes("https://myaccount.google.com/permissions"));
assert.ok((await readFile(new URL("terms.html", root), "utf8")).includes("https://www.youtube.com/t/terms"));
console.log("Static site verified: six public assets; local links and policy links present.");

