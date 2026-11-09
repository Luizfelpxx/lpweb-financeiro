"use client";

import { useEffect } from "react";

/** Registra o service worker (instalação como PWA). Só em produção. */
export default function RegistrarSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* sem service worker o app continua funcionando normalmente */
    });
  }, []);
  return null;
}
