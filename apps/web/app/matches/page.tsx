"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { IdentifierKind } from "@xmtp/browser-sdk";
import { useMiniPay } from "@/hooks/useMiniPay";
import { useXMTP } from "@/hooks/useXMTP";
import { getSupabase } from "@/lib/supabase";
import type { Match, Profile } from "@/lib/database.types";

interface MatchItem {
    match: Match;
    partner: Profile | null;
    preview: string | null;
    previewLoading: boolean;
}

export default function MatchesPage() {
    const { address, isLoading: walletLoading } = useMiniPay();
    const me = address?.toLowerCase() ?? null;
    const xmtp = useXMTP();

    const [items, setItems] = useState<MatchItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!me) return;
        setLoading(true);
        setError(null);
        try {
            const supabase = getSupabase();
            const { data: matches, error: matchesErr } = await supabase
                .from("matches")
                .select("*")
                .or(`user_a.eq.${me},user_b.eq.${me}`)
                .eq("is_active", true)
                .order("matched_at", { ascending: false });
            if (matchesErr) throw matchesErr;

            const partners = Array.from(
                new Set(
                    (matches ?? []).map((m) =>
                        (m.user_a.toLowerCase() === me
                            ? m.user_b
                            : m.user_a
                        ).toLowerCase()
                    )
                )
            );

            const profilesByAddr = new Map<string, Profile>();
            if (partners.length > 0) {
                const { data: profs, error: profErr } = await supabase
                    .from("profiles")
                    .select("*")
                    .in("wallet_address", partners);
                if (profErr) throw profErr;
                for (const p of profs ?? []) {
                    profilesByAddr.set(p.wallet_address.toLowerCase(), p);
                }
            }

            setItems(
                (matches ?? []).map((m) => {
                    const partnerAddr = (
                        m.user_a.toLowerCase() === me ? m.user_b : m.user_a
                    ).toLowerCase();
                    return {
                        match: m,
                        partner: profilesByAddr.get(partnerAddr) ?? null,
                        preview: null,
                        previewLoading: true,
                    };
                })
            );
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not load matches");
        } finally {
            setLoading(false);
        }
    }, [me]);

    useEffect(() => {
        if (me) load();
    }, [me, load]);

    // Fetch the last message from XMTP for each match so the list mirrors
    // a real inbox. Previews come from XMTP only — Supabase never stores
    // message content.
    useEffect(() => {
        if (xmtp.status !== "ready" || items.length === 0 || !me) return;
        const client = xmtp.client;
        let cancelled = false;

        (async () => {
            const updated = await Promise.all(
                items.map(async (item) => {
                    if (item.preview !== null || !item.previewLoading) return item;
                    const partnerAddr = (
                        item.match.user_a.toLowerCase() === me
                            ? item.match.user_b
                            : item.match.user_a
                    ).toLowerCase();
                    try {
                        const partnerInboxId =
                            await client.fetchInboxIdByIdentifier({
                                identifier: partnerAddr,
                                identifierKind: IdentifierKind.Ethereum,
                            });
                        if (!partnerInboxId) {
                            return { ...item, previewLoading: false };
                        }
                        const dm = await client.conversations.getDmByInboxId(
                            partnerInboxId
                        );
                        if (!dm) {
                            return { ...item, previewLoading: false };
                        }
                        const msgs = await dm.messages({ limit: 1n });
                        const last = msgs[msgs.length - 1];
                        const preview =
                            last && typeof last.content === "string"
                                ? last.content
                                : null;
                        return { ...item, preview, previewLoading: false };
                    } catch {
                        return { ...item, previewLoading: false };
                    }
                })
            );
            if (!cancelled) setItems(updated);
        })();

        return () => {
            cancelled = true;
        };
    }, [xmtp, items, me]);

    const initialLoading = walletLoading || (loading && items.length === 0);

    return (
        <main className="min-h-dvh bg-background">
            <div className="mx-auto max-w-md px-4 pb-24 pt-6">
                <header className="mb-6 flex items-center gap-3">
                    <Link
                        href="/discover"
                        aria-label="Back"
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground hover:border-primary hover:text-primary"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div>
                        <h1 className="font-serif text-4xl leading-tight">
                            Matches
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Encrypted chat with the people you&apos;ve connected
                            with.
                        </p>
                    </div>
                </header>

                {error && (
                    <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                        {error}
                    </p>
                )}
                {xmtp.status === "error" && (
                    <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        Chat is offline: {xmtp.error}
                    </p>
                )}

                {initialLoading ? (
                    <div className="flex h-[60vh] items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
                        <div className="font-serif text-3xl">No matches yet</div>
                        <p className="max-w-xs text-sm text-muted-foreground">
                            Head to discovery and send a connection request to
                            get things started.
                        </p>
                        <Link
                            href="/discover"
                            className="mt-3 rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground"
                        >
                            Discover people
                        </Link>
                    </div>
                ) : (
                    <ul className="flex flex-col gap-3">
                        {items.map(({ match, partner, preview, previewLoading }) => {
                            const partnerAddr = (
                                match.user_a.toLowerCase() === me
                                    ? match.user_b
                                    : match.user_a
                            ).toLowerCase();
                            const name =
                                partner?.display_name ?? shorten(partnerAddr);
                            const photo = partner?.photos?.[0];
                            return (
                                <li key={match.id}>
                                    <Link
                                        href={`/chat/${match.id}`}
                                        className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition hover:border-primary"
                                    >
                                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-muted">
                                            {photo ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={photo}
                                                    alt={name}
                                                    className="h-full w-full object-cover"
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center font-serif text-xl text-muted-foreground">
                                                    {name.slice(0, 1).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-baseline gap-2">
                                                <span className="truncate font-serif text-lg">
                                                    {name}
                                                </span>
                                                {partner?.age && (
                                                    <span className="text-sm text-muted-foreground">
                                                        {partner.age}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="line-clamp-1 text-xs text-muted-foreground">
                                                {preview
                                                    ? preview
                                                    : previewLoading &&
                                                      xmtp.status === "ready"
                                                    ? "Loading…"
                                                    : xmtp.status === "ready"
                                                    ? "Say hello"
                                                    : "Tap to chat"}
                                            </p>
                                        </div>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </main>
    );
}

function shorten(addr: string): string {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
