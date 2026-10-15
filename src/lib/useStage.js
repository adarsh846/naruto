import { useEffect, useRef } from 'react';
import { clamp } from './assets.js';

const DPR = () => Math.min(window.devicePixelRatio || 1, 1.5);

// Sizes a canvas to its parent and runs `frame` every animation frame while the
// section is on screen. `frame` gets { ctx, w, h, progress, t, dt } where
// progress is 0..1 across the section's scrollable travel.
export function useStage(sectionRef, canvasRef, frame, onResize) {
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const resizeRef = useRef(onResize);
  resizeRef.current = onResize;

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;

    const ctx = canvas.getContext('2d');
    let w = 0;
    let h = 0;
    let raf = 0;
    let last = performance.now();
    let isVisible = false;
    let sectionOffsetTop = 0;
    let sectionHeight = 0;

    const measureSection = () => {
      const r = section.getBoundingClientRect();
      sectionOffsetTop = r.top + window.scrollY;
      sectionHeight = r.height;
    };

    const resize = () => {
      const dpr = DPR();
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      measureSection();
      resizeRef.current?.({ w, h, dpr });
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    window.addEventListener('resize', measureSection);

    const loop = (now) => {
      if (!isVisible) return;
      raf = requestAnimationFrame(loop);

      const vh = window.innerHeight;
      const top = sectionOffsetTop - window.scrollY;
      const bottom = top + sectionHeight;
      if (bottom < -60 || top > vh + 60 || !w) {
        last = now;
        return;
      }
      const travel = sectionHeight - vh;
      const progress = travel > 0 ? clamp(-top / travel) : top <= 0 ? 1 : 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const r = { top, bottom, height: sectionHeight, width: w };
      frameRef.current({ ctx, w, h, progress, t: now / 1000, dt, rect: r });
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible) {
          measureSection();
          last = performance.now();
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(loop);
        } else {
          cancelAnimationFrame(raf);
        }
      },
      { rootMargin: '120px 0px 120px 0px' },
    );
    io.observe(section);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('resize', measureSection);
    };
  }, [sectionRef, canvasRef]);
}
