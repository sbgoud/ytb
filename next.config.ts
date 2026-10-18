import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  outputFileTracingIncludes: {
    "/api/download": [
      "./node_modules/ffmpeg-static/ffmpeg",
      "./bin/yt-dlp*",
    ],
    "/app/api/download": [
      "./node_modules/ffmpeg-static/ffmpeg",
      "./bin/yt-dlp*",
    ],
  },
};

export default nextConfig;
