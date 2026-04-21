"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { Gender, Profile } from "@/lib/database.types";

const PAGE_SIZE = 20;

interface UseProfilesResult {
    profiles: Profile[];
    isLoading: boolean;
    isRefreshing: boolean;
    hasMore: boolean;
    error: string | null;
    loadMore: () => void;
    refresh: () => void;
}

// Seeded shuffle so the discovery feed varies between refreshes without
// reordering within a single scroll session.
function shuffle<T>(arr: T[], seed: number): T[] {
    const out = [...arr];
    let s = seed || 1;
    for (let i = out.length - 1; i > 0; i--) {
        s = (s * 9301 + 49297) % 233280;
        const j = Math.floor((s / 233280) * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

// Discovery feed: fetch active profiles that match the viewer's seeking
// preference, excluding the viewer themselves, profiles the viewer has already
// sent a connection request to (pending or declined — a declined request means
// the recipient rejected the viewer and should not reappear), and existing
// match partners. Order is randomized per fetch cycle; pagination is client-
// side on the shuffled pool so that the viewer never sees a duplicate within a
// session.
export function useProfiles(viewerAddress: string | null | undefined): UseProfilesResult {
    const [pool, setPool] = useState<Profile[]>([]);
    const [shown, setShown] = useState<Profile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 1_000_000));
    const cursorRef = useRef(0);

    const load = useCallback(
        async (refreshing: boolean) => {
            if (!viewerAddress) return;
            if (refreshing) setIsRefreshing(true);
            else setIsLoading(true);
            setError(null);
            try {
                const supabase = getSupabase();
                const viewer = viewerAddress.toLowerCase();

                const { data: me, error: meErr } = await supabase
                    .from("profiles")
                    .select("seeking")
                    .eq("wallet_address", viewer)
                    .maybeSingle();
                if (meErr) throw meErr;
                if (!me) {
                    setPool([]);
                    setShown([]);
                    cursorRef.current = 0;
                    return;
                }
                const seeking = me.seeking as Gender;

                const [reqsRes, matchesARes, matchesBRes] = await Promise.all([
                    supabase
                        .from("connection_requests")
                        .select("recipient")
                        .eq("sender", viewer),
                    supabase.from("matches").select("user_b").eq("user_a", viewer),
                    supabase.from("matches").select("user_a").eq("user_b", viewer),
                ]);
                if (reqsRes.error) throw reqsRes.error;
                if (matchesARes.error) throw matchesARes.error;
                if (matchesBRes.error) throw matchesBRes.error;

                const excluded = new Set<string>([viewer]);
                for (const r of reqsRes.data ?? []) excluded.add(r.recipient.toLowerCase());
                for (const m of matchesARes.data ?? []) excluded.add(m.user_b.toLowerCase());
                for (const m of matchesBRes.data ?? []) excluded.add(m.user_a.toLowerCase());

                const { data: rows, error: rowsErr } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("is_active", true)
                    .eq("gender", seeking)
                    .limit(500);
                if (rowsErr) throw rowsErr;

                const filtered = (rows ?? []).filter(
                    (p) => !excluded.has(p.wallet_address.toLowerCase())
                );
                const fresh = shuffle(filtered, refreshing ? Date.now() : seed);
                setPool(fresh);
                cursorRef.current = 0;
                const first = fresh.slice(0, PAGE_SIZE);
                setShown(first);
                cursorRef.current = first.length;
            } catch (e) {
                setError(e instanceof Error ? e.message : "Could not load profiles");
            } finally {
                if (refreshing) setIsRefreshing(false);
                else setIsLoading(false);
            }
        },
        [viewerAddress, seed]
    );

    useEffect(() => {
        if (viewerAddress) load(false);
    }, [viewerAddress, load]);

    const loadMore = useCallback(() => {
        if (cursorRef.current >= pool.length) return;
        const next = pool.slice(cursorRef.current, cursorRef.current + PAGE_SIZE);
        cursorRef.current += next.length;
        setShown((s) => [...s, ...next]);
    }, [pool]);

    const refresh = useCallback(() => {
        setSeed(Math.floor(Math.random() * 1_000_000));
        load(true);
    }, [load]);

    return {
        profiles: shown,
        isLoading,
        isRefreshing,
        hasMore: cursorRef.current < pool.length,
        error,
        loadMore,
        refresh,
    };
}
