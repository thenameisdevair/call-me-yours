"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import {
    checkMilestones,
    persistTriggered,
    type TriggeredMilestone,
} from "@/lib/milestoneEngine";

// Manages the milestone check loop for a single match. After each chat
// session update the caller calls `checkNow()`. The hook:
//   1. Queries the engine for newly triggered milestones.
//   2. Persists them to Supabase immediately (dedup via unique constraint),
//      so that both users' clients can race safely without double-firing.
//   3. Surfaces the persisted set as `pendingMilestones` for the UI to
//      display the celebratory notification.
//
// Dismissing a milestone only clears it from local state — the DB row stays,
// which is what guarantees the "never fire twice" rule across sessions.

export function useMilestones(matchId: string | null) {
    const [pendingMilestones, setPending] = useState<TriggeredMilestone[]>([]);
    const inFlight = useRef(false);

    const checkNow = useCallback(async () => {
        if (!matchId || inFlight.current) return;
        inFlight.current = true;
        try {
            const supabase = getSupabase();
            const triggered = await checkMilestones(supabase, matchId);
            if (triggered.length === 0) return;
            const newlyPersisted = await persistTriggered(
                supabase,
                matchId,
                triggered
            );
            if (newlyPersisted.length === 0) return;
            setPending((prev) => {
                const seen = new Set(prev.map((p) => p.id));
                const toAdd = newlyPersisted.filter((p) => !seen.has(p.id));
                return toAdd.length ? [...prev, ...toAdd] : prev;
            });
        } catch (e) {
            console.warn("milestone check failed", e);
        } finally {
            inFlight.current = false;
        }
    }, [matchId]);

    // Run once when a match is bound so time-based milestones (MS-06/07/10)
    // can surface even in sessions where no new message is sent.
    useEffect(() => {
        if (!matchId) return;
        void checkNow();
    }, [matchId, checkNow]);

    const dismissMilestone = useCallback((id: string) => {
        setPending((prev) => prev.filter((m) => m.id !== id));
    }, []);

    const fulfillMilestone = useCallback((id: string) => {
        // Optimistic removal from the pending queue. The gift flow (Step 9b)
        // is responsible for writing the on-chain fulfillment and updating
        // the `milestones.fulfilled_*` columns. Fulfillment is optional —
        // the milestone row remains regardless of whether a gift follows.
        setPending((prev) => prev.filter((m) => m.id !== id));
    }, []);

    return {
        pendingMilestones,
        checkMilestones: checkNow,
        dismissMilestone,
        fulfillMilestone,
    };
}
