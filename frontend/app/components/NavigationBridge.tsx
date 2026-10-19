"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { setNavigate } from "@/lib/api";

// Lets lib/actions.ts move between pages without a full reload.
export default function NavigationBridge() {
  const router = useRouter();
  useEffect(() => {
    setNavigate((url) => router.push(url));
  }, [router]);
  return null;
}
