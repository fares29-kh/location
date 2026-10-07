'use client';

import { useEffect, useState } from 'react';

/** Horodatage courant, rafraîchi périodiquement (badges « urgent », repère « maintenant »). */
export function useNow(refreshMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, refreshMs);
    return () => {
      window.clearInterval(timer);
    };
  }, [refreshMs]);

  return now;
}
