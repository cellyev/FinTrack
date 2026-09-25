/* eslint-disable react-hooks/rules-of-hooks */
import { useCallback, useEffect } from 'react';
import * as ExpoRouter from 'expo-router';

/**
 * Safe wrapper around useFocusEffect that works both in production (Expo Router)
 * and in Jest test environments where expo-router might be partially mocked.
 */
export function useScreenFocus(
  callback: () => void | (() => void) | Promise<unknown>,
  deps: React.DependencyList = []
): void {
  const focusEffect = (ExpoRouter as Record<string, unknown>).useFocusEffect;

  if (typeof focusEffect === 'function') {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    (focusEffect as (effect: () => void | (() => void)) => void)(
      useCallback(() => {
        const cleanup = callback();
        if (typeof cleanup === 'function') {
          return cleanup;
        }
        return undefined;
      }, deps)
    );
  } else {
    // Fallback in unit tests
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
      const cleanup = callback();
      if (typeof cleanup === 'function') {
        return cleanup;
      }
      return undefined;
    }, deps);
  }
}
