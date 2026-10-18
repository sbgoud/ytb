# YouTube → MP3

A small Next.js app: paste a YouTube link, click **Download MP3**, and get the
audio back as an MP3 file (medium quality, ~130 kbps VBR, converted with
[yt-dlp](https://github.com/yt-dlp/yt-dlp) and ffmpeg on the server).

## Requirements

- Node.js 20+
- yt-dlp — either on `PATH` (`brew install yt-dlp`), or run
  `npm run fetch-ytdlp` once to download a standalone binary into `bin/`.
  Keep it fresh: old versions break when YouTube changes.
- ffmpeg — no install needed; the `ffmpeg-static` package ships a binary.

Optional environment overrides: `YT_DLP_PATH`, `FFMPEG_PATH`.

## Development

```bash
npm install
npm run fetch-ytdlp   # optional if yt-dlp is already on your PATH
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), paste a YouTube URL, and
hit the button. The first conversion can take a few seconds.

## How it works

- `app/page.tsx` — URL form; POSTs to the API and saves the returned MP3 blob.
- `app/api/download/route.ts` — validates the URL (youtube.com / youtu.be),
  runs `yt-dlp --extract-audio --audio-format mp3 --audio-quality 5` with the
  bundled/downloaded yt-dlp and the `ffmpeg-static` binary, streams the MP3
  back, and cleans up the temp dir. The response is streamed, which avoids
  Vercel's 4.5 MB response-body limit.
- `scripts/fetch-ytdlp.mjs` — downloads the latest official yt-dlp binary for
  the current platform into `bin/`.
- `next.config.ts` — `outputFileTracingIncludes` packs `bin/yt-dlp` and the
  ffmpeg binary into the serverless function.

## Deploying to Vercel

This works on Vercel's Hobby plan (Fluid compute, `maxDuration` 300s):

1. Push to GitHub and import the repo at [vercel.com/new](https://vercel.com/new).
2. No settings needed. Vercel runs the `vercel-build` script, which downloads
   the latest Linux yt-dlp binary, then runs `next build` with the binaries
   traced into the function.
3. Redeploy (without build cache) whenever you want a newer yt-dlp.

Notes:

- YouTube sometimes blocks datacenter IPs with "Sign in to confirm you're not
  a bot". If that happens: export cookies from a throwaway browser session as
  a Netscape-format `cookies.txt`, base64-encode it (`base64 -i cookies.txt`),
  and set the result as the `YT_DLP_COOKIES` env var in your Vercel project.
  Treat that value like a password.

## Docker / other hosts

Any container host works too (Railway, Render, Fly.io, a VPS). The included
`Dockerfile` installs yt-dlp and ffmpeg itself:

```bash
docker build -t ytb .
docker run -p 3000:3000 ytb
```
