'use client';

import { useState, useCallback, useId } from 'react';

/**
 * Prevents double-submit in forms.
 *
 * Usage:
 *   const { isLocked, lock, unlock, idempotencyKey } = useSubmitLock();
 *   async function handleSubmit() {
 *     if (!lock()) return;
 *     try {
 *       await save({ ...data, idempotency_key: idempotencyKey });
 *     } finally {
 *       unlock();
 *     }
 *   }
 */
export function useSubmitLock() {
  const id = useId();
  const [isLocked, setIsLocked] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => `${id}-0`);

  const lock = useCallback((): boolean => {
    if (isLocked) return false;
    setIsLocked(true);
    return true;
  }, [isLocked]);

  const unlock = useCallback(() => {
    setIsLocked(false);
    setIdempotencyKey((prev) => {
      const n = parseInt(prev.split('-').pop() ?? '0', 10) + 1;
      return `${id}-${n}`;
    });
  }, [id]);

  return { isLocked, lock, unlock, idempotencyKey };
}
