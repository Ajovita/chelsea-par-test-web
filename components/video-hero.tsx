"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, Pause, Play } from "lucide-react";

export default function VideoHero({ src, poster }: { src: string; poster: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  function play(video: HTMLVideoElement) {
    video.muted = true;
    if (!video.getAttribute("src")) video.src = src;
    void video.play().catch(() => setPlaying(false));
  }

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (motion.matches) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } else {
        video.muted = true;
        video.src = src;
        void video.play().catch(() => setPlaying(false));
      }
    };
    sync();
    motion.addEventListener("change", sync);
    return () => {
      motion.removeEventListener("change", sync);
      video.pause();
    };
  }, [src]);

  return (
    <section className="video-hero" aria-labelledby="hero-title">
      <video ref={videoRef} poster={poster} muted loop playsInline preload="none" aria-hidden="true"
        onPlaying={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setPlaying(false)} />
      <div className="video-hero-copy">
        <h1 id="hero-title">KOLD.</h1>
        <p className="video-hero-line"><span>Worlds</span><span>Come</span><span>To life</span></p>
        <p className="video-hero-tagline">Bringing the world of your brand to life</p>
      </div>
      <div className="video-hero-controls">
        <a href="#work">Explore the work <ArrowDown size={15} aria-hidden="true" /></a>
        <button type="button" aria-label={playing ? "Pause background video" : "Play background video"}
          onClick={() => {
            const video = videoRef.current;
            if (!video) return;
            if (video.paused) play(video); else video.pause();
          }}>
          {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
        </button>
      </div>
    </section>
  );
}
