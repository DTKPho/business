import { useEffect } from 'react';
import { useGameStore } from './store';

const TICK_MS = 1200;

export function useGameLoop() {
  useEffect(() => {
    const interval = window.setInterval(() => {
      useGameStore.getState().tick();
    }, TICK_MS);
    return () => window.clearInterval(interval);
  }, []);
}
