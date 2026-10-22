import { useEffect, useRef } from 'react';

/** Executa o callback periodicamente enquanto a aba estiver visível. */
export function useInterval(callback: () => void, delayMs: number | null) {
  const saved = useRef(callback);
  saved.current = callback;

  useEffect(() => {
    if (delayMs === null) return;
    const tick = () => {
      if (document.visibilityState === 'visible') saved.current();
    };
    const id = window.setInterval(tick, delayMs);
    const onVisible = () => document.visibilityState === 'visible' && saved.current();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [delayMs]);
}
