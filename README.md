# YouTube → MP3

A small Next.js app: paste a YouTube link, click **Download MP3**, and get the
audio back as an MP3 file (medium quality, ~130 kbps VBR, converted with
[yt-dlp](https://github.com/yt-dlp/yt-dlp) and ffmpeg on the server).

## Requirements

- Node.js 20+
- `yt-dlp` on `PATH` (keep it updated — YouTube changes often break old
  versions: `brew upgrade yt-dlp` or `yt-dlp -U`)
- `ffmpeg` on `PATH` (needed for the MP3 conversion)

If `yt-dlp` lives somewhere else, point `YT_DLP_PATH` at it.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), paste a YouTube URL, and
hit the button. The first conversion can take a few seconds.

## How it works

- `app/page.tsx` — URL form; POSTs to the API and saves the returned MP3 blob.
- `app/api/download/route.ts` — validates the URL (youtube.com / youtu.be),
  runs `yt-dlp --extract-audio --audio-format mp3 --audio-quality 5` into a
  temp dir, streams the file back with the video title as filename, and cleans
  up the temp dir.

## Deployment

**Vercel will not work for this app.** Serverless functions can't run the
`yt-dlp`/`ffmpeg` binaries, Hobby-plan responses are capped at ~4.5 MB, and
YouTube often blocks datacenter IPs.

Deploy the included `Dockerfile` (yt-dlp + ffmpeg preinstalled) to a container
host instead — Railway, Render, Fly.io, or any VPS:

```bash
docker build -t ytb .
docker run -p 3000:3000 ytb
```

Update `yt-dlp` inside the image periodically (or rebuild it) since old
versions stop working when YouTube changes their site.
