"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMiniPay } from "@/hooks/useMiniPay";
import { supabase } from "@/lib/supabase";

// Root route decides where a MiniPay user lands:
//   - existing profile → /discover
//   - no profile        → /onboard
// The gate in layout.tsx has already confirmed we are inside MiniPay by the
// time this component renders, so we only handle the routing decision here.
export default function RootPage() {
    const router = useRouter();
    const { address } = useMiniPay();

    useEffect(() => {
        if (!address) return;
        let cancelled = false;
        (async () => {
            const { data, error } = await supabase
                .from("profiles")
                .select("wallet_address")
                .eq("wallet_address", address)
                .maybeSingle();
            if (cancelled) return;
            if (error) {
                // Profile table unreachable or RLS blocked us — default to onboard.
                router.replace("/onboard");
                return;
            }
            router.replace(data ? "/discover" : "/onboard");
        })();
        return () => {
            cancelled = true;
        };
    }, [address, router]);

    return (
        <div className="flex min-h-dvh items-center justify-center p-6">
            <p className="text-muted-foreground text-sm">Loading…</p>
        </div>
    );
}
