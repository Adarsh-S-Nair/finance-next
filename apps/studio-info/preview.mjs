import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
const routes = new Map([["/","index.html"],["/privacy","privacy.html"],["/terms","terms.html"],["/styles.css","styles.css"],["/channel-logo.png","channel-logo.png"]]);
createServer(async (req,res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  const file = routes.get(path) ?? "404.html";
  const mime = file.endsWith(".css") ? "text/css" : file.endsWith(".png") ? "image/png" : "text/html; charset=utf-8";
  try { const data = await readFile(new URL("./public/"+file, import.meta.url)); res.writeHead(routes.has(path)?200:404, {"Content-Type":mime}); res.end(req.method==="HEAD"?undefined:data); }
  catch { res.writeHead(500); res.end("Preview unavailable"); }
}).listen(4325,"127.0.0.1",()=>console.log("http://127.0.0.1:4325"));

