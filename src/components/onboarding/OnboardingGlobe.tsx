import { useEffect, useRef } from "react";
import createGlobe from "cobe";

interface OnboardingGlobeProps {
  onCoordinatesChange: (lat: number, lon: number) => void;
  initialPhi: number;
  initialTheta: number;
  initialScale: number;
  phiRef: React.MutableRefObject<number>;
  thetaRef: React.MutableRefObject<number>;
  scaleRef: React.MutableRefObject<number>;
}

export default function OnboardingGlobe({
  onCoordinatesChange,
  initialPhi,
  initialTheta,
  initialScale,
  phiRef,
  thetaRef,
  scaleRef,
}: OnboardingGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const onCoordinatesChangeRef = useRef(onCoordinatesChange);
  onCoordinatesChangeRef.current = onCoordinatesChange;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.touchAction = "none";
    canvas.style.cursor = "grab";
    canvas.className = "bg-transparent";
    container.appendChild(canvas);

    phiRef.current = initialPhi;
    thetaRef.current = initialTheta;
    scaleRef.current = initialScale;

    let disposed = false;

    const globe = createGlobe(canvas, {
      devicePixelRatio: 2,
      width: canvas.offsetWidth * 2,
      height: canvas.offsetHeight * 2,
      phi: phiRef.current,
      theta: thetaRef.current,
      dark: 1,
      diffuse: 1.15,
      mapSamples: 14000,
      mapBrightness: 7,
      baseColor: [0.12, 0.18, 0.2],
      markerColor: [0.93, 0.46, 0.3],
      glowColor: [0.74, 0.95, 1.0],
      scale: scaleRef.current,
    });

    let frameId = 0;
    const renderFrame = () => {
      if (disposed) return;
      try {
        globe.update({
          phi: phiRef.current,
          theta: thetaRef.current,
          scale: scaleRef.current,
          width: Math.max(1, canvas.offsetWidth * 2),
          height: Math.max(1, canvas.offsetHeight * 2),
        });
      } catch {
        disposed = true;
        return;
      }
      frameId = window.requestAnimationFrame(renderFrame);
    };
    frameId = window.requestAnimationFrame(renderFrame);

    const emitCoordinates = () => {
      const lon = Number((((-phiRef.current * 180) / Math.PI - 90 + 540) % 360 - 180).toFixed(4));
      const lat = Number(Math.max(-85, Math.min(85, (thetaRef.current * 180) / Math.PI)).toFixed(4));
      onCoordinatesChangeRef.current(lat, lon);
    };

    const onPointerDown = (event: PointerEvent) => {
      pointerIdRef.current = event.pointerId;
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (pointerIdRef.current !== event.pointerId) return;
      const dx = event.clientX - lastPointerRef.current.x;
      const dy = event.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
      phiRef.current += dx * 0.0075;
      thetaRef.current = Math.max(-1.25, Math.min(1.25, thetaRef.current + dy * 0.0065));
      emitCoordinates();
    };

    const onPointerUp = (event: PointerEvent) => {
      if (pointerIdRef.current !== event.pointerId) return;
      pointerIdRef.current = null;
      emitCoordinates();
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        // noop
      }
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.05 : 0.05;
      scaleRef.current = Math.max(0.82, Math.min(2.7, scaleRef.current + delta));
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    emitCoordinates();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      try {
        globe.destroy();
      } catch {
        // noop — cobe may have already cleaned up
      }
      // Imperatively clear the container so React never sees cobe's DOM nodes
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
    />
  );
}
