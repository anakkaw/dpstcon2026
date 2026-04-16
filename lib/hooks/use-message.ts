"use client";

import { useState, useCallback, useRef } from "react";

type MessageTone = "success" | "danger" | "info" | "warning";

interface MessageState {
  text: string;
  tone: MessageTone;
}

export function useMessage(autoHideMs = 5000) {
  const [msg, setMsg] = useState<MessageState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showMessage = useCallback(
    (text: string, tone: MessageTone = "success") => {
      setMsg({ text, tone });
      clearTimeout(timerRef.current);
      if (autoHideMs > 0) {
        timerRef.current = setTimeout(() => setMsg(null), autoHideMs);
      }
    },
    [autoHideMs],
  );

  const clearMessage = useCallback(() => {
    clearTimeout(timerRef.current);
    setMsg(null);
  }, []);

  return { message: msg?.text ?? "", messageTone: msg?.tone ?? "success", showMessage, clearMessage, hasMessage: !!msg };
}
