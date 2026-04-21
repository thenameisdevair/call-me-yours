// CMY milestone engine.
//
// Evaluates the milestone library (MS-01..MS-10) against a match's behavioral
// state stored in Supabase. The engine never inspects message content — it
// reasons only over session metadata (chat_sessions) and immutable timestamps
// (matches.matched_at, connection_requests.responded_at).
//
// Two hard rules enforced here:
//   1. A milestone can never trigger twice for the same match. Once recorded
//      in the milestones table it is permanently filtered out.
//   2. Streak milestones require activity on distinct calendar days — this is
//      the "spread across distinct sessions" rate limit. A user cannot force
//      a streak by hammering messages on a single day.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type MilestoneId =
    | "MS-01"
    | "MS-02"
    | "MS-03"
    | "MS-04"
    | "MS-05"
    | "MS-06"
    | "MS-07"
    | "MS-08"
    | "MS-09"
    | "MS-10";

export interface MilestoneDef {
    id: MilestoneId;
    name: string;
    description: string;
    suggestion: string;
}

export const MILESTONES: Record<MilestoneId, MilestoneDef> = {
    "MS-01": {
        id: "MS-01",
        name: "First Spark",
        description: "You sent your first message. Something just began.",
        suggestion: "A Warm Heart is a gentle way to mark it.",
    },
    "MS-02": {
        id: "MS-02",
        name: "Breaking The Ice",
        description: "You're both talking. The conversation is alive.",
        suggestion: "A Red Rose keeps the warmth going.",
    },
    "MS-03": {
        id: "MS-03",
        name: "Three Day Streak",
        description: "Three days in a row — this is becoming a habit.",
        suggestion: "A Sweet Candy to celebrate the rhythm.",
    },
    "MS-04": {
        id: "MS-04",
        name: "One Week Strong",
        description: "Seven straight days of showing up for each other.",
        suggestion: "A Gold Star feels earned.",
    },
    "MS-05": {
        id: "MS-05",
        name: "Two Weeks Together",
        description: "Two weeks of staying close. This is real.",
        suggestion: "A Gold Star — or something more.",
    },
    "MS-06": {
        id: "MS-06",
        name: "One Month",
        description: "A full month since you matched.",
        suggestion: "A Diamond Ring marks the month.",
    },
    "MS-07": {
        id: "MS-07",
        name: "Three Months",
        description: "Ninety days. This is no longer a beginning.",
        suggestion: "A Diamond Ring for ninety days well spent.",
    },
    "MS-08": {
        id: "MS-08",
        name: "First Gift Sent",
        description: "The first gift has crossed between you.",
        suggestion: "Reply in kind when the moment feels right.",
    },
    "MS-09": {
        id: "MS-09",
        name: "Gift Returned",
        description: "Both of you have given. That's rare.",
        suggestion: "Keep the reciprocity alive.",
    },
    "MS-10": {
        id: "MS-10",
        name: "Early Bird",
        description: "The reply came within an hour. That's a sign.",
        suggestion: "A Warm Heart to acknowledge the speed.",
    },
};

export const MILESTONE_ORDER: MilestoneId[] = [
    "MS-01",
    "MS-02",
    "MS-03",
    "MS-04",
    "MS-05",
    "MS-06",
    "MS-07",
    "MS-08",
    "MS-09",
    "MS-10",
];

type Client = SupabaseClient<Database>;

/**
 * True when `sessions` contains at least `n` consecutive calendar days of
 * activity. Session dates are `YYYY-MM-DD` strings (UTC). Any day the pair
 * did not exchange messages breaks the streak.
 */
export function hasConsecutiveDays(
    sessions: { session_date: string }[],
    n: number
): boolean {
    if (n <= 0) return true;
    if (sessions.length < n) return false;

    const uniqueSorted = Array.from(
        new Set(sessions.map((s) => s.session_date))
    ).sort();

    let run = 1;
    for (let i = 1; i < uniqueSorted.length; i++) {
        const prev = Date.parse(uniqueSorted[i - 1] + "T00:00:00Z");
        const curr = Date.parse(uniqueSorted[i] + "T00:00:00Z");
        const diffDays = Math.round((curr - prev) / 86_400_000);
        run = diffDays === 1 ? run + 1 : 1;
        if (run >= n) return true;
    }
    return run >= n;
}

function daysSince(iso: string): number {
    const then = Date.parse(iso);
    if (Number.isNaN(then)) return 0;
    return Math.floor((Date.now() - then) / 86_400_000);
}

export interface TriggeredMilestone {
    id: MilestoneId;
    def: MilestoneDef;
}

/**
 * Evaluate every applicable milestone for `matchId` and return those that
 * should fire now but have not been recorded yet. The caller is expected to
 * insert the returned ids into `milestones` immediately — this is what
 * prevents double-firing across both users' clients.
 *
 * Gift-based milestones (MS-08, MS-09) are recorded by the gift flow, not
 * here, and are omitted from the return value.
 */
export async function checkMilestones(
    supabase: Client,
    matchId: string
): Promise<TriggeredMilestone[]> {
    const { data: match, error: matchErr } = await supabase
        .from("matches")
        .select("id, matched_at, is_active, user_a, user_b")
        .eq("id", matchId)
        .maybeSingle();

    if (matchErr || !match || !match.is_active) return [];

    const [sessionsRes, existingRes] = await Promise.all([
        supabase
            .from("chat_sessions")
            .select("session_date, message_count")
            .eq("match_id", matchId)
            .order("session_date", { ascending: true }),
        supabase
            .from("milestones")
            .select("milestone_id")
            .eq("match_id", matchId),
    ]);

    const sessions = sessionsRes.data ?? [];
    const existing = new Set(
        (existingRes.data ?? []).map((row) => row.milestone_id as MilestoneId)
    );

    const triggered: TriggeredMilestone[] = [];
    const fire = (id: MilestoneId) => {
        if (!existing.has(id)) {
            triggered.push({ id, def: MILESTONES[id] });
            existing.add(id);
        }
    };

    // MS-01 First Spark: at least one session exists for the match. Sessions
    // are only inserted when a message is sent, so the presence of any row
    // means the first message has gone out.
    if (sessions.length >= 1) fire("MS-01");

    // MS-02 Breaking The Ice: a reply has happened. The chat_sessions row is
    // shared by both users (unique on match_id+session_date) and count is
    // incremented on every send, so message_count >= 2 on any single day OR
    // activity on two different days both imply a back-and-forth.
    const maxCount = sessions.reduce(
        (m, s) => Math.max(m, s.message_count),
        0
    );
    if (maxCount >= 2 || sessions.length >= 2) fire("MS-02");

    // MS-03/04/05 streak milestones — consecutive calendar days of sessions.
    if (hasConsecutiveDays(sessions, 3)) fire("MS-03");
    if (hasConsecutiveDays(sessions, 7)) fire("MS-04");
    if (hasConsecutiveDays(sessions, 14)) fire("MS-05");

    // MS-06/07 anniversary milestones — elapsed days since match_at.
    const sinceMatch = daysSince(match.matched_at);
    if (sinceMatch >= 30) fire("MS-06");
    if (sinceMatch >= 90) fire("MS-07");

    // MS-10 Early Bird — the accepted connection request for this pair
    // responded within 1 hour of being sent.
    const { data: reqs } = await supabase
        .from("connection_requests")
        .select("created_at, responded_at, status, sender, recipient")
        .in("sender", [match.user_a, match.user_b])
        .in("recipient", [match.user_a, match.user_b])
        .eq("status", "accepted")
        .limit(2);
    if (reqs && reqs.length) {
        const accepted = reqs.find(
            (r) =>
                r.responded_at &&
                Date.parse(r.responded_at) - Date.parse(r.created_at) <=
                    60 * 60 * 1000
        );
        if (accepted) fire("MS-10");
    }

    return triggered;
}

/**
 * Insert triggered milestones into the `milestones` table. Uses upsert on
 * (match_id, milestone_id) so that if two clients race, the second insert
 * becomes a no-op rather than an error. The DB schema is the source of
 * truth for "has this fired" — never rely on local state alone.
 */
export async function persistTriggered(
    supabase: Client,
    matchId: string,
    triggered: TriggeredMilestone[]
): Promise<TriggeredMilestone[]> {
    if (triggered.length === 0) return [];
    const rows = triggered.map((t) => ({
        match_id: matchId,
        milestone_id: t.id,
    }));
    const { data, error } = await supabase
        .from("milestones")
        .upsert(rows, {
            onConflict: "match_id,milestone_id",
            ignoreDuplicates: true,
        })
        .select("milestone_id");
    if (error) {
        console.warn("milestone upsert failed", error.message);
        return [];
    }
    const inserted = new Set((data ?? []).map((r) => r.milestone_id));
    return triggered.filter((t) => inserted.has(t.id));
}
