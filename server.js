const http = require("http");
const os = require("os");
const path = require("path");

const express = require("express");

const app = express();
const server = http.createServer(app);

const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_DIR = path.join(__dirname, "public");

function localAddresses() {
  const addresses = [];
  for (const details of Object.values(os.networkInterfaces())) {
    for (const item of details || []) {
      if (item.family === "IPv4" && !item.internal) addresses.push(item.address);
    }
  }
  return addresses;
}

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, app: "crime-scene-investigation" });
});

app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));

app.use((_req, res) => {
  res.status(404).send("Not found");
});

server.listen(PORT, HOST, () => {
  console.log(`Crime scene investigation ready: http://localhost:${PORT}`);
  for (const address of localAddresses()) {
    console.log(`LAN: http://${address}:${PORT}`);
  }
});
