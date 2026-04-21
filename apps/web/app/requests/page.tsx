"use client";

import { ArrowLeft, Check, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import { useMiniPay } from "@/hooks/useMiniPay";
import {
    acceptRequest as acceptRequestTx,
    declineRequest as declineRequestTx,
} from "@/lib/contracts";
import { checkTransactionSuccess } from "@/lib/viem";
import { getSupabase } from "@/lib/supabase";
import type { ConnectionRequest, Profile } from "@/lib/database.types";

interface IncomingRequest {
    request: ConnectionRequest;
    sender: Profile | null;
}

type Busy = { address: string; action: "accept" | "decline" } | null;

export default function RequestsPage() {
    const router = useRouter();
    const { address, isLoading: walletLoading } = useMiniPay();
    const me = address?.toLowerCase();

    const [items, setItems] = useState<IncomingRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<Busy>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!me) return;
        setLoading(true);
        setError(null);
        try {
            const supabase = getSupabase();
            const { data: reqs, error: reqsErr } = await supabase
                .from("connection_requests")
                .select("*")
                .eq("recipient", me)
                .eq("status", "pending")
                .order("created_at", { ascending: false });
            if (reqsErr) throw reqsErr;

            const senders = Array.from(
                new Set((reqs ?? []).map((r) => r.sender.toLowerCase()))
            );
            const profilesByAddr = new Map<string, Profile>();
            if (senders.length > 0) {
                const { data: profs, error: profErr } = await supabase
                    .from("profiles")
                    .select("*")
                    .in("wallet_address", senders);
                if (profErr) throw profErr;
                for (const p of profs ?? []) {
                    profilesByAddr.set(p.wallet_address.toLowerCase(), p);
                }
            }

            setItems(
                (reqs ?? []).map((r) => ({
                    request: r,
                    sender: profilesByAddr.get(r.sender.toLowerCase()) ?? null,
                }))
            );
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not load requests");
        } finally {
            setLoading(false);
        }
    }, [me]);

    useEffect(() => {
        if (me) load();
    }, [me, load]);

    async function onAccept(req: ConnectionRequest) {
        if (!me) return;
        setActionError(null);
        setBusy({ address: req.sender, action: "accept" });
        try {
            const txHash = await acceptRequestTx(me as Address, req.sender as Address);
            const ok = await checkTransactionSuccess(txHash);
            if (!ok) throw new Error("Transaction failed on-chain");

            const supabase = getSupabase();
            // Matches table has a symmetric pair — store in a deterministic
            // order so (user_a, user_b) uniqueness is stable regardless of who
            // accepted.
            const [userA, userB] =
                req.sender.toLowerCase() < me ? [req.sender, me] : [me, req.sender];

            const { error: insertErr } = await supabase.from("matches").insert({
                user_a: userA.toLowerCase(),
                user_b: userB.toLowerCase(),
                tx_hash: txHash,
            });
            if (insertErr) throw insertErr;

            const { error: updErr } = await supabase
                .from("connection_requests")
                .update({
                    status: "accepted",
                    responded_at: new Date().toISOString(),
                })
                .eq("id", req.id);
            if (updErr) throw updErr;

            router.push("/matches");
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Could not accept";
            if (!/reject|denied|cancel/i.test(msg)) setActionError(msg);
        } finally {
            setBusy(null);
        }
    }

    async function onDecline(req: ConnectionRequest) {
        if (!me) return;
        setActionError(null);
        setBusy({ address: req.sender, action: "decline" });
        try {
            const txHash = await declineRequestTx(me as Address, req.sender as Address);
            const ok = await checkTransactionSuccess(txHash);
            if (!ok) throw new Error("Transaction failed on-chain");

            const supabase = getSupabase();
            const { error: updErr } = await supabase
                .from("connection_requests")
                .update({
                    status: "declined",
                    responded_at: new Date().toISOString(),
                })
                .eq("id", req.id);
            if (updErr) throw updErr;

            setItems((xs) => xs.filter((x) => x.request.id !== req.id));
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Could not decline";
            if (!/reject|denied|cancel/i.test(msg)) setActionError(msg);
        } finally {
            setBusy(null);
        }
    }

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
                        <h1 className="font-serif text-4xl leading-tight">Requests</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            People who&apos;d like to connect with you.
                        </p>
                    </div>
                </header>

                {actionError && (
                    <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                        {actionError}
                    </p>
                )}
                {error && (
                    <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                        {error}
                    </p>
                )}

                {initialLoading ? (
                    <div className="flex h-[60vh] items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
                        <div className="font-serif text-3xl">No requests yet</div>
                        <p className="max-w-xs text-sm text-muted-foreground">
                            When someone wants to connect with you, you&apos;ll see
                            them here.
                        </p>
                    </div>
                ) : (
                    <ul className="flex flex-col gap-3">
                        {items.map(({ request, sender }) => {
                            const isBusy = busy?.address === request.sender;
                            const senderAddr = request.sender.toLowerCase();
                            const photo = sender?.photos?.[0];
                            const name = sender?.display_name ?? shorten(senderAddr);
                            return (
                                <li
                                    key={request.id}
                                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                                >
                                    <Link
                                        href={`/profile/${senderAddr}`}
                                        className="flex flex-1 items-center gap-3 min-w-0"
                                    >
                                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-muted">
                                            {photo ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={photo}
                                                    alt={name}
                                                    className="h-full w-full object-cover"
                                                    loading="lazy"
                                                    decoding="async"
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
                                                {sender && (
                                                    <span className="text-sm text-muted-foreground">
                                                        {sender.age}
                                                    </span>
                                                )}
                                            </div>
                                            {sender?.bio && (
                                                <p className="line-clamp-1 text-xs text-muted-foreground">
                                                    {sender.bio}
                                                </p>
                                            )}
                                        </div>
                                    </Link>
                                    <div className="flex shrink-0 items-center gap-2">
                                        <button
                                            type="button"
                                            aria-label="Decline"
                                            onClick={() => onDecline(request)}
                                            disabled={Boolean(busy)}
                                            className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-foreground hover:text-foreground disabled:opacity-50"
                                        >
                                            {isBusy && busy?.action === "decline" ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <X className="h-4 w-4" />
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            aria-label="Accept"
                                            onClick={() => onAccept(request)}
                                            disabled={Boolean(busy)}
                                            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                                        >
                                            {isBusy && busy?.action === "accept" ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Check className="h-4 w-4" />
                                            )}
                                        </button>
                                    </div>
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
