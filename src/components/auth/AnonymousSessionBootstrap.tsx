"use client";

import { useEffect } from "react";
import { ensureAnonymousSession } from "@/lib/auth/anonymous-client";

/**
 * Mounted once in the root layout: guarantees every visitor has a session
 * (anonymous if needed) so projects, uploads, and team scoping always work
 * without a sign-in wall. Renders nothing.
 */
export function AnonymousSessionBootstrap() {
  useEffect(() => {
    void ensureAnonymousSession();
  }, []);

  return null;
}
