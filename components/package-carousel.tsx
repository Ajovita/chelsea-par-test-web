"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";

export default function PackageCarousel({ children }: { children: ReactNode[] }) {
  const [viewportRef, carousel] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    loop: false,
    breakpoints: { "(prefers-reduced-motion: reduce)": { duration: 0 } },
  });
  const [navigation, setNavigation] = useState({ index: 0, count: 0, previous: false, next: false });

  useEffect(() => {
    if (!carousel) return;
    const sync = () => setNavigation({
      index: carousel.selectedScrollSnap(),
      count: carousel.scrollSnapList().length,
      previous: carousel.canScrollPrev(),
      next: carousel.canScrollNext(),
    });
    sync();
    carousel.on("select", sync).on("reInit", sync);
    return () => { carousel.off("select", sync).off("reInit", sync); };
  }, [carousel]);

  return <div className="package-carousel" role="region" aria-roledescription="carousel" aria-labelledby="packages-title">
    <div id="package-carousel-track" className="package-viewport" ref={viewportRef} tabIndex={0} aria-label="Package cards" aria-describedby="package-carousel-help" onKeyDown={event => {
      if (event.target !== event.currentTarget || !carousel) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); carousel.scrollPrev(); }
      if (event.key === "ArrowRight") { event.preventDefault(); carousel.scrollNext(); }
      if (event.key === "Home") { event.preventDefault(); carousel.scrollTo(0); }
      if (event.key === "End") { event.preventDefault(); carousel.scrollTo(navigation.count - 1); }
    }}>
      <div className="offers">{children.map((child, index) => <div className="package-slide" key={index} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${children.length}`}>{child}</div>)}</div>
    </div>
    <div className="carousel-footer">
      <p id="package-carousel-help">Swipe or use the arrows to explore all five packages.</p>
      <div className="carousel-navigation">
        <button type="button" className="carousel-arrow" aria-label="Previous packages" aria-controls="package-carousel-track" disabled={!navigation.previous} onClick={() => carousel?.scrollPrev()}><ArrowLeft size={19}/></button>
        <div className="carousel-dots" aria-label="Package carousel positions">{Array.from({ length: navigation.count }, (_, index) => <button type="button" key={index} aria-label={`Go to carousel position ${index + 1}`} aria-current={navigation.index === index ? "true" : undefined} aria-controls="package-carousel-track" onClick={() => carousel?.scrollTo(index)}><span/></button>)}</div>
        <button type="button" className="carousel-arrow" aria-label="Next packages" aria-controls="package-carousel-track" disabled={!navigation.next} onClick={() => carousel?.scrollNext()}><ArrowRight size={19}/></button>
      </div>
      <span className="sr-only" role="status" aria-live="polite">{navigation.count ? `Carousel position ${navigation.index + 1} of ${navigation.count}` : ""}</span>
    </div>
  </div>;
}
