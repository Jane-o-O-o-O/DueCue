"use client";
import { useEffect, useImperativeHandle, useLayoutEffect, useRef } from "react";
import type { ReactNode, Ref, RefObject } from "react";

const settle = "cubic-bezier(.22,1,.36,1)";
export function reducedMotion() {
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

// Record the current visual positions before React moves keyed rows or cards.
// A second tap starts from the in-flight position, so reversals stay continuous.
export function useMovingItems(revision: string | number) {
  const group = useRef<HTMLDivElement>(null);
  const before = useRef(new Map<string, DOMRect>());
  const running = useRef(new Map<HTMLElement, Animation>());
  function capture() {
    const rects = before.current;
    rects.clear();
    if (reducedMotion()) return;
    group.current
      ?.querySelectorAll<HTMLElement>("[data-motion-id]")
      .forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.bottom >= -100 && rect.top <= window.innerHeight + 100)
          rects.set(el.dataset.motionId!, rect);
      });
  }
  useLayoutEffect(() => {
    const rects = before.current;
    if (!rects.size || !group.current) return;
    running.current.forEach((a) => a.cancel());
    running.current.clear();
    if (!reducedMotion()) {
      const plans = Array.from(
        group.current.querySelectorAll<HTMLElement>("[data-motion-id]"),
      ).map((el) => ({
        el,
        from: rects.get(el.dataset.motionId!),
        to: el.getBoundingClientRect(),
      }));
      for (const { el, from, to } of plans) {
        if (!el.animate || to.bottom < 0 || to.top > window.innerHeight + 100)
          continue;
        const dx = from ? from.left - to.left : 0;
        const dy = from ? from.top - to.top : 7;
        if (from && Math.abs(dx) + Math.abs(dy) < 0.8) continue;
        const animation = el.animate(
          [
            {
              transform: `translate3d(${dx}px,${dy}px,0)`,
              opacity: from ? 1 : 0,
            },
            { transform: "translate3d(0,0,0)", opacity: 1 },
          ],
          { duration: from ? 300 : 190, easing: settle },
        );
        running.current.set(el, animation);
        animation.onfinish = () => {
          if (running.current.get(el) === animation) running.current.delete(el);
        };
      }
    }
    rects.clear();
  }, [revision]);
  useEffect(() => {
    const animations = running.current;
    const cancel = () => {
      animations.forEach((a) => a.cancel());
      animations.clear();
    };
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    media?.addEventListener("change", cancel);
    return () => {
      cancel();
      media?.removeEventListener("change", cancel);
    };
  }, []);
  return { group, capture };
}

// The departing face may leave the four-card stack entirely on wraparound.
export function releaseCard(
  deck: HTMLDivElement | null,
  slot: HTMLDivElement | null,
  direction: number,
) {
  const front = deck?.querySelector<HTMLElement>(".front");
  if (!front || !slot || !front.animate) return;
  slot.replaceChildren();
  if (reducedMotion()) return;
  const face = front.cloneNode(true) as HTMLElement;
  const rect = front.getBoundingClientRect(),
    base = slot.getBoundingClientRect();
  face.removeAttribute("data-motion-id");
  face.tabIndex = -1;
  Object.assign(face.style, {
    inset: "auto",
    left: rect.left - base.left + "px",
    top: rect.top - base.top + "px",
    width: rect.width + "px",
    height: rect.height + "px",
    transform: "none",
    scale: "none",
  });
  slot.appendChild(face);
  const movement = direction > 0 ? -1 : 1;
  const animation = face.animate(
    [
      { transform: "translate3d(0,0,0) rotate(0)", opacity: 1 },
      {
        transform: `translate3d(${movement * 30}px,4px,0) rotate(${movement * 2}deg)`,
        opacity: 0,
      },
    ],
    { duration: 195, easing: "cubic-bezier(.3,.02,.45,1)", fill: "forwards" },
  );
  animation.onfinish = animation.oncancel = () => face.remove();
}

export type DialogControl = { dismiss: () => void };
export function DialogLayer({
  controller,
  onDismiss,
  returnFocus,
  children,
}: {
  controller: Ref<DialogControl>;
  onDismiss: () => void;
  returnFocus: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const leaving = useRef(false);
  const latest = useRef(onDismiss);
  latest.current = onDismiss;
  function dismiss() {
    if (leaving.current || !layer.current) return;
    leaving.current = true;
    const root = layer.current,
      sheet = root.querySelector<HTMLElement>(".sheet");
    if (!sheet?.animate || reducedMotion()) {
      latest.current();
      return;
    }
    root.dataset.leaving = "true";
    sheet.inert = true;
    // Start the exit at the current entrance pose, even if the user taps close immediately.
    const current = getComputedStyle(sheet);
    const mobile = window.matchMedia("(max-width:680px)").matches;
    const exit = sheet.animate(
      [
        { transform: current.transform, opacity: current.opacity },
        {
          transform: mobile
            ? "translate3d(0,50px,0)"
            : "translate3d(0,9px,0) scale(.985)",
          opacity: 0,
        },
      ],
      { duration: 175, easing: "cubic-bezier(.35,0,.7,.38)", fill: "forwards" },
    );
    root.animate(
      [{ opacity: getComputedStyle(root).opacity }, { opacity: 0 }],
      { duration: 180, easing: "ease-in", fill: "forwards" },
    );
    void exit.finished
      .catch(() => {})
      .then(() => {
        if (root.isConnected) latest.current();
      });
  }
  useImperativeHandle(controller, () => ({ dismiss }));
  useEffect(() => {
    const root = layer.current!,
      opener = returnFocus.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not([hidden]),select,textarea,summary,[tabindex="0"]',
        ),
      ).filter((el) => !el.closest("[inert]") && el.getClientRects().length);
    if (!root.contains(document.activeElement))
      focusables()[0]?.focus({ preventScroll: true });
    function key(e: KeyboardEvent) {
      if (e.key === "Escape" && !root.querySelector('[aria-busy="true"]')) {
        e.preventDefault();
        dismiss();
      }
      if (e.key !== "Tab") return;
      const list = focusables();
      if (!list.length) return;
      const edge = e.shiftKey ? list[0] : list[list.length - 1];
      if (
        document.activeElement === edge ||
        !root.contains(document.activeElement)
      ) {
        e.preventDefault();
        (e.shiftKey ? list[list.length - 1] : list[0]).focus();
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", key);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [returnFocus]);
  return (
    <div
      className="modalLayer"
      ref={layer}
      onClick={(e) => {
        if (
          e.target === e.currentTarget &&
          !layer.current?.querySelector('[aria-busy="true"]')
        )
          dismiss();
      }}
    >
      {children}
    </div>
  );
}
