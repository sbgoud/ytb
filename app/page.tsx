"use client";

import { useState, type FormEvent } from "react";
import styles from "./page.module.css";

function filenameFrom(header: string | null): string | null {
  if (!header) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      return utf8[1];
    }
  }
  const plain = /filename="([^"]+)"/i.exec(header);
  return plain ? plain[1] : null;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const trimmed = url.trim();
    if (!trimmed) {
      setError("Paste a YouTube URL first.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? `Request failed (${response.status}).`);
      }

      const blob = await response.blob();
      const filename =
        filenameFrom(response.headers.get("Content-Disposition")) ??
        "audio.mp3";
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>YouTube → MP3</h1>
        <p className={styles.subtitle}>
          Paste a YouTube video link and download its audio as an MP3 file
          (medium quality).
        </p>
        <form className={styles.form} onSubmit={handleSubmit}>
          <input
            className={styles.input}
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
            disabled={busy}
            autoFocus
          />
          <button className={styles.button} type="submit" disabled={busy}>
            {busy ? "Converting… this can take a moment" : "Download MP3"}
          </button>
        </form>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <p className={styles.note}>
          Conversion runs on the server with yt-dlp and ffmpeg. Only download
          content you have the rights to.
        </p>
      </div>
    </main>
  );
}
