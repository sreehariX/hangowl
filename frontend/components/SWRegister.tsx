"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/register-sw";

export function SWRegister() {
  useEffect(() => {
    registerServiceWorker();
  }, []);
  return null;
}
