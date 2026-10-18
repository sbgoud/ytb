import { createWriteStream } from "node:fs";
import { access, chmod, mkdir } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const ASSET_BY_PLATFORM = {
  linux: "yt-dlp_linux",
  darwin: "yt-dlp_macos",
  win32: "yt-dlp.exe",
};

const asset = ASSET_BY_PLATFORM[process.platform];
if (!asset) {
  console.error(`Unsupported platform: ${process.platform}`);
  process.exit(1);
}

const fileName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
const target = path.join(process.cwd(), "bin", fileName);

try {
  await access(target);
  console.log(`yt-dlp already present at ${target}`);
  process.exit(0);
} catch {}

await mkdir(path.dirname(target), { recursive: true });

const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`;
console.log(`Downloading ${url}`);
const response = await fetch(url, { redirect: "follow" });
if (!response.ok || !response.body) {
  console.error(`Download failed with HTTP ${response.status}`);
  process.exit(1);
}

await pipeline(Readable.fromWeb(response.body), createWriteStream(target));
await chmod(target, 0o755);
console.log(`Saved ${target}`);
