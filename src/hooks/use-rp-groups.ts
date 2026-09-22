"use client";

import { listRpGroups, type RpGroupOption } from "@/lib/rp-groups";
import { useEffect, useState } from "react";

export function useRpGroups() {
  const [groups, setGroups] = useState<RpGroupOption[]>(() => listRpGroups());

  useEffect(() => {
    const refresh = () => setGroups(listRpGroups());
    refresh();
    window.addEventListener("refgm:rp-groups-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("refgm:rp-groups-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return groups;
}
