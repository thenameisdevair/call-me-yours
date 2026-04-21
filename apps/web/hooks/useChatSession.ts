"use client";

import { useCallback } from "react";
import { getSupabase } from "@/lib/supabase";

// Records chat session metadata — never message content. A `session` is the
// set of messages a match exchanged on a given calendar day (UTC). We count
// messages per day so the milestone engine can later reason about streaks
// and intensity without ever reading cleartext.

function todayIsoDate(): string {
    // UTC date — matches the `date` column semantics in Postgres and keeps
    // streak detection consistent across timezones.
    return new Date().toISOString().slice(0, 10);
}

export function useChatSession(matchId: string | null) {
    const recordMessageSent = useCallback(async () => {
        if (!matchId) return;
        const supabase = getSupabase();
        const session_date = todayIsoDate();

        // There is a unique (match_id, session_date) constraint; fetch then
        // insert-or-update to increment the counter without overwriting it.
        const { data: existing, error: selectErr } = await supabase
            .from("chat_sessions")
            .select("id, message_count")
            .eq("match_id", matchId)
            .eq("session_date", session_date)
            .maybeSingle();

        if (selectErr) {
            console.warn("chat_sessions select failed", selectErr.message);
            return;
        }

        if (existing) {
            await supabase
                .from("chat_sessions")
                .update({ message_count: existing.message_count + 1 })
                .eq("id", existing.id);
            return;
        }

        await supabase
            .from("chat_sessions")
            .insert({ match_id: matchId, session_date, message_count: 1 });
    }, [matchId]);

    return { recordMessageSent };
}
