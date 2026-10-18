import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export const maxDuration = 60;

const YT_DLP_PATH = process.env.YT_DLP_PATH ?? "yt-dlp";

const ALLOWED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

function isAllowedUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

function runYtDlp(
  url: string,
  outputTemplate: string
): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      /* turbopackIgnore: true */ YT_DLP_PATH,
      [
        "--no-playlist",
        "--no-progress",
        "--extract-audio",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "5",
        "--output",
        outputTemplate,
        url,
      ],
      { stdio: ["ignore", "ignore", "pipe"] }
    );

    let stderr = "";
    child.stderr.on("data", (chunk: string | Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > 16_000) {
        stderr = stderr.slice(-16_000);
      }
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stderr }));
  });
}

function errorFromStderr(stderr: string): string {
  const lines = stderr
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const errorLine =
    lines.find((line) => line.startsWith("ERROR:")) ?? lines.at(-1);
  if (!errorLine) {
    return "yt-dlp failed to process this URL.";
  }
  return errorLine.replace(/^ERROR:\s*/, "");
}

function fileStream(
  filePath: string,
  onDone: () => Promise<void>
): ReadableStream<Uint8Array> {
  const stream = createReadStream(filePath);
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    onDone().catch(() => {});
  };

  return new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on("data", (chunk: string | Buffer) =>
        controller.enqueue(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
      );
      stream.on("end", () => {
        controller.close();
        finish();
      });
      stream.on("error", (error) => {
        controller.error(error);
        finish();
      });
    },
    cancel() {
      stream.destroy();
      finish();
    },
  });
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be JSON." },
      { status: 400 }
    );
  }

  const rawUrl =
    typeof payload === "object" && payload !== null && "url" in payload
      ? (payload as { url?: unknown }).url
      : undefined;
  const url = typeof rawUrl === "string" ? rawUrl.trim() : "";

  if (!isAllowedUrl(url)) {
    return Response.json(
      { error: "Enter a valid YouTube URL (youtube.com or youtu.be)." },
      { status: 400 }
    );
  }

  let workDir: string;
  try {
    workDir = await mkdtemp(path.join(tmpdir(), "ytb-"));
  } catch {
    return Response.json(
      { error: "Could not create a temporary work directory." },
      { status: 500 }
    );
  }

  let handedOff = false;
  try {
    const outputTemplate = path.join(workDir, "%(title)s.%(ext)s");
    const { code, stderr } = await runYtDlp(url, outputTemplate);

    if (code !== 0) {
      return Response.json({ error: errorFromStderr(stderr) }, { status: 422 });
    }

    const mp3Name = (await readdir(workDir)).find((name) =>
      name.toLowerCase().endsWith(".mp3")
    );

    if (!mp3Name) {
      return Response.json(
        { error: "yt-dlp did not produce an MP3 file." },
        { status: 500 }
      );
    }

    const filePath = path.join(workDir, mp3Name);
    const { size } = await stat(filePath);
    const asciiName = mp3Name.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");

    handedOff = true;
    return new Response(
      fileStream(filePath, () => rm(workDir, { recursive: true, force: true })),
      {
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Length": String(size),
          "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(mp3Name)}`,
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return Response.json(
        {
          error:
            "yt-dlp is not installed on the server. Install it (e.g. brew install yt-dlp) or set YT_DLP_PATH.",
        },
        { status: 500 }
      );
    }
    console.error("download failed:", error);
    return Response.json(
      { error: "Download failed unexpectedly." },
      { status: 500 }
    );
  } finally {
    if (!handedOff) {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
