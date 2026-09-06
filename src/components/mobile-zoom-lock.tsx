"use client";
import { useEffect } from "react";

// Impede o zoom quando a página está sendo vista como PWA instalada (modo
// standalone, com ou sem toque) e também em celular/tablet no navegador
// comum. Assim a tela não "aumenta/diminui" na versão PWA.
export function MobileZoomLock() {
  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    const touchOnly = coarse && !fine;
    if (!touchOnly && !standalone) return;

    const isEditableTarget = (target: EventTarget | null) =>
      target instanceof Element &&
      Boolean(target.closest("input, textarea, select, [contenteditable]"));

    const remove: Array<() => void> = [];

    if (touchOnly) {
      const onTouchMove = (event: TouchEvent) => {
        if (event.touches.length > 1) event.preventDefault();
      };

      let lastTapAt = 0;
      let lastTapX = 0;
      let lastTapY = 0;
      const onTouchStart = (event: TouchEvent) => {
        if (event.touches.length > 1) {
          event.preventDefault();
          lastTapAt = 0;
          return;
        }
        if (isEditableTarget(event.target)) return;
        const touch = event.touches[0];
        const now = Date.now();
        const isDoubleTap =
          now - lastTapAt < 350 &&
          Math.abs(touch.clientX - lastTapX) < 40 &&
          Math.abs(touch.clientY - lastTapY) < 40;
        lastTapAt = now;
        lastTapX = touch.clientX;
        lastTapY = touch.clientY;
        if (isDoubleTap) event.preventDefault();
      };

      document.addEventListener("touchmove", onTouchMove, { passive: false });
      document.addEventListener("touchstart", onTouchStart, { passive: false });
      remove.push(
        () => document.removeEventListener("touchmove", onTouchMove),
        () => document.removeEventListener("touchstart", onTouchStart),
      );
    }

    if (standalone) {
      // Ctrl/Cmd + scroll (inclui pinça de trackpad) e atalhos de zoom.
      const onWheel = (event: WheelEvent) => {
        if (event.ctrlKey || event.metaKey) event.preventDefault();
      };
      const onKeyDown = (event: KeyboardEvent) => {
        if (!event.ctrlKey && !event.metaKey) return;
        const key = event.key;
        if (
          key === "+" || key === "-" || key === "=" || key === "0" ||
          key === "NumpadAdd" || key === "NumpadSubtract"
        ) {
          event.preventDefault();
        }
      };
      document.addEventListener("wheel", onWheel, { passive: false });
      document.addEventListener("keydown", onKeyDown);
      remove.push(
        () => document.removeEventListener("wheel", onWheel),
        () => document.removeEventListener("keydown", onKeyDown),
      );
    }

    return () => remove.forEach((cleanup) => cleanup());
  }, []);

  return null;
}
