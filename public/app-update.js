const versionPattern = /^[a-f0-9]{20}$/;
const versionParam = "__duecue_release";

/** @param {string} version */
export function applyAppVersion(version) {
  const next = new URL(location.href);
  if (next.searchParams.get(versionParam) === version) return;
  next.searchParams.set(versionParam, version);
  location.replace(next.href);
}

/**
 * @param {string} current
 * @param {(latest: string) => void} onUpdate
 * @returns {() => void}
 */
export function watchAppVersion(current, onUpdate) {
  if (!versionPattern.test(current)) return () => {};

  const url = new URL(location.href);
  if (url.searchParams.get(versionParam) === current) {
    url.searchParams.delete(versionParam);
    history.replaceState(history.state, "", url.href);
  }

  /** @type {AbortController | undefined} */
  let pending;
  const check = async () => {
    if (document.visibilityState !== "visible") {
      pending?.abort();
      pending = undefined;
      return;
    }
    if (pending) return;
    const request = new AbortController();
    pending = request;
    const timeout = setTimeout(() => request.abort(), 5000);
    try {
      const response = await fetch("/api/app-version", {
        cache: "no-store",
        signal: request.signal,
      });
      if (!response.ok) return;
      const latest = (await response.text()).trim();
      if (!request.signal.aborted && versionPattern.test(latest)) {
        onUpdate(latest === current ? "" : latest);
      }
    } catch {
      // Retry the next time the page comes back into view or reconnects.
    } finally {
      clearTimeout(timeout);
      if (pending === request) pending = undefined;
    }
  };

  const returnEvents = ["pageshow", "focus", "online"];
  document.addEventListener("visibilitychange", check);
  for (const event of returnEvents) window.addEventListener(event, check);
  void check();

  return () => {
    pending?.abort();
    document.removeEventListener("visibilitychange", check);
    for (const event of returnEvents) window.removeEventListener(event, check);
  };
}

if (typeof document !== "undefined") {
  const landing = document.querySelector('meta[name="duecue-release"]');
  if (landing instanceof HTMLMetaElement) {
    watchAppVersion(landing.content, (latest) => {
      if (latest) applyAppVersion(latest);
    });
  }
}
