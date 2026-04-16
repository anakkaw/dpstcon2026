"use client";

import { useEffect, useCallback, useRef } from "react";

/**
 * Warns users before leaving a page with unsaved changes.
 * @param isDirty - whether the form has unsaved changes
 * @param message - optional custom message (browsers may ignore this)
 */
export function useUnsavedChanges(isDirty: boolean, message?: string) {
  const isDirtyRef = useRef(isDirty);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  const handler = useCallback(
    (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      // Modern browsers ignore the return value but still show a dialog
      e.returnValue = message || "";
    },
    [message]
  );

  useEffect(() => {
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [handler]);
}
