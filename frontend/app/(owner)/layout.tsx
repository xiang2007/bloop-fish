"use client";

import { useApi } from "@/lib/api";
import type { navData } from "@backend/lib/pages";
import OwnerNav from "./OwnerNav";

type NavData = Awaited<ReturnType<typeof navData>>;

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { data } = useApi<NavData>("/nav");

  return (
    <div className="min-h-dvh lg:pl-64">
      {data && (
        <OwnerNav
          ponds={data.ponds}
          readyPonds={data.readyPonds}
          userName={data.userName}
          scenario={data.scenario}
        />
      )}
      <main className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">{children}</main>
    </div>
  );
}
