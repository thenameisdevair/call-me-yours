"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

// Lightweight count of incoming pending connection requests. Polled on mount
// and whenever the address changes; kept deliberately simple — no realtime
// subscription in V1.
export function usePendingRequestCount(viewer: string | null | undefined): number {
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!viewer) {
            setCount(0);
            return;
        }
        let cancelled = false;
        (async () => {
            const supabase = getSupabase();
            const { count: c } = await supabase
                .from("connection_requests")
                .select("id", { count: "exact", head: true })
                .eq("recipient", viewer.toLowerCase())
                .eq("status", "pending");
            if (!cancelled) setCount(c ?? 0);
        })();
        return () => {
            cancelled = true;
        };
    }, [viewer]);

    return count;
}
