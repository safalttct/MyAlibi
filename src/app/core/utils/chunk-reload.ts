const RELOAD_KEY = 'myalibi:chunk-reload';

function isChunkLoadError(reason: unknown): boolean {
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : reason && typeof reason === 'object' && 'message' in reason
          ? String((reason as { message: unknown }).message)
          : '';

  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /ChunkLoadError/i.test(message)
  );
}

/**
 * Vite/Angular can leave the browser holding a stale lazy-chunk URL after a
 * rebuild. One forced reload recovers; a second failure is left alone so we
 * do not loop.
 */
export function installChunkReloadGuard(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const reloadOnce = (reason: unknown): void => {
    if (!isChunkLoadError(reason)) {
      return;
    }
    if (sessionStorage.getItem(RELOAD_KEY) === '1') {
      sessionStorage.removeItem(RELOAD_KEY);
      return;
    }
    sessionStorage.setItem(RELOAD_KEY, '1');
    window.location.reload();
  };

  window.addEventListener('unhandledrejection', (event) => {
    reloadOnce(event.reason);
  });

  window.addEventListener('error', (event) => {
    reloadOnce(event.error ?? event.message);
  });

  // Clear the guard after a successful boot so future rebuilds can recover again.
  queueMicrotask(() => {
    sessionStorage.removeItem(RELOAD_KEY);
  });
}
