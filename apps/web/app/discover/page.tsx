"use client";

import { Inbox, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import ProfileCard from "@/components/ProfileCard";
import { useMiniPay } from "@/hooks/useMiniPay";
import { usePendingRequestCount } from "@/hooks/usePendingRequestCount";
import { useProfiles } from "@/hooks/useProfiles";

export default function DiscoverPage() {
    const { address, isLoading: walletLoading } = useMiniPay();
    const { profiles, isLoading, isRefreshing, hasMore, error, loadMore, refresh } =
        useProfiles(address?.toLowerCase());
    const pendingCount = usePendingRequestCount(address?.toLowerCase());

    const sentinelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = sentinelRef.current;
        if (!el) return;
        const io = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting && hasMore && !isLoading && !isRefreshing) {
                    loadMore();
                }
            },
            { rootMargin: "400px 0px" }
        );
        io.observe(el);
        return () => io.disconnect();
    }, [hasMore, isLoading, isRefreshing, loadMore]);

    const showInitialLoader = walletLoading || (isLoading && profiles.length === 0);

    return (
        <main className="min-h-dvh bg-background">
            <div className="mx-auto max-w-md px-4 pb-24 pt-6">
                <header className="mb-6 flex items-end justify-between">
                    <div>
                        <h1 className="font-serif text-4xl leading-tight">Discover</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Take your time. Tap anyone to learn more.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href="/requests"
                            aria-label={
                                pendingCount > 0
                                    ? `Requests (${pendingCount} pending)`
                                    : "Requests"
                            }
                            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-primary hover:text-primary"
                        >
                            <Inbox className="h-4 w-4" />
                            {pendingCount > 0 && (
                                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                                    {pendingCount > 99 ? "99+" : pendingCount}
                                </span>
                            )}
                        </Link>
                        <button
                            type="button"
                            onClick={refresh}
                            disabled={isRefreshing || isLoading}
                            aria-label="Refresh feed"
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
                        >
                            <RefreshCw
                                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                            />
                        </button>
                    </div>
                </header>

                {error && (
                    <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                        {error}
                    </p>
                )}

                {showInitialLoader ? (
                    <div className="flex h-[60vh] items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                ) : profiles.length === 0 ? (
                    <EmptyState onRefresh={refresh} refreshing={isRefreshing} />
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            {profiles.map((p, idx) => (
                                <ProfileCard
                                    key={p.wallet_address}
                                    profile={p}
                                    priority={idx < 2}
                                />
                            ))}
                        </div>
                        <div ref={sentinelRef} className="h-8" />
                        {hasMore && (
                            <div className="flex justify-center py-4">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                        )}
                        {!hasMore && profiles.length > 0 && (
                            <p className="py-6 text-center text-xs text-muted-foreground">
                                You&apos;ve seen everyone for now. Check back soon.
                            </p>
                        )}
                    </>
                )}
            </div>
        </main>
    );
}

function EmptyState({
    onRefresh,
    refreshing,
}: {
    onRefresh: () => void;
    refreshing: boolean;
}) {
    return (
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
            <div className="font-serif text-3xl leading-tight">No one new yet</div>
            <p className="max-w-xs text-sm text-muted-foreground">
                Call Me Yours is small and growing. Check back in a little while —
                new people are joining every day.
            </p>
            <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                className="mt-2 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium transition hover:border-primary hover:text-primary disabled:opacity-50"
            >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
            </button>
        </div>
    );
}
