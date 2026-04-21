"use client";

import { ArrowLeft, ChevronLeft, ChevronRight, Heart, Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { Profile } from "@/lib/database.types";

export default function ProfileDetailPage() {
    const params = useParams<{ address: string }>();
    const router = useRouter();
    const rawAddress = typeof params?.address === "string" ? params.address : "";
    const address = rawAddress.toLowerCase();

    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [photoIdx, setPhotoIdx] = useState(0);
    const trackRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!address) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const supabase = getSupabase();
                const { data, error } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("wallet_address", address)
                    .maybeSingle();
                if (cancelled) return;
                if (error) throw error;
                if (!data) {
                    setError("Profile not found");
                } else {
                    setProfile(data);
                }
            } catch (e) {
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : "Could not load profile");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [address]);

    const photos = profile?.photos ?? [];
    const hasMultiple = photos.length > 1;

    function scrollToPhoto(i: number) {
        const el = trackRef.current;
        if (!el) return;
        const clamped = Math.max(0, Math.min(i, photos.length - 1));
        setPhotoIdx(clamped);
        el.scrollTo({ left: el.clientWidth * clamped, behavior: "smooth" });
    }

    function onScroll() {
        const el = trackRef.current;
        if (!el) return;
        const i = Math.round(el.scrollLeft / el.clientWidth);
        if (i !== photoIdx) setPhotoIdx(i);
    }

    if (loading) {
        return (
            <main className="flex min-h-dvh items-center justify-center p-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </main>
        );
    }

    if (error || !profile) {
        return (
            <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
                <h1 className="font-serif text-3xl">Profile unavailable</h1>
                <p className="text-sm text-muted-foreground">
                    {error ?? "We couldn't find that profile."}
                </p>
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="rounded-xl border border-border px-4 py-2 text-sm font-medium transition hover:border-primary hover:text-primary"
                >
                    Go back
                </button>
            </main>
        );
    }

    return (
        <main className="min-h-dvh bg-background pb-28">
            <div className="relative">
                <div
                    ref={trackRef}
                    onScroll={onScroll}
                    className="flex aspect-[3/4] w-full snap-x snap-mandatory overflow-x-auto scroll-smooth bg-muted [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                    {photos.length === 0 ? (
                        <div className="flex aspect-[3/4] w-full shrink-0 items-center justify-center">
                            <span className="font-serif text-5xl text-muted-foreground">
                                {profile.display_name.slice(0, 1)}
                            </span>
                        </div>
                    ) : (
                        photos.map((src, i) => (
                            <div
                                key={src}
                                className="aspect-[3/4] w-full shrink-0 snap-center"
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={src}
                                    alt={`${profile.display_name} photo ${i + 1}`}
                                    className="h-full w-full object-cover"
                                    loading={i === 0 ? "eager" : "lazy"}
                                    decoding="async"
                                />
                            </div>
                        ))
                    )}
                </div>

                <button
                    type="button"
                    onClick={() => router.back()}
                    aria-label="Back"
                    className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>

                {hasMultiple && (
                    <>
                        <div className="pointer-events-none absolute inset-x-3 top-3 flex gap-1">
                            {photos.map((_, i) => (
                                <div
                                    key={i}
                                    className={`h-1 flex-1 rounded-full transition-colors ${
                                        i === photoIdx ? "bg-white" : "bg-white/30"
                                    }`}
                                />
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() => scrollToPhoto(photoIdx - 1)}
                            disabled={photoIdx === 0}
                            aria-label="Previous photo"
                            className="absolute left-2 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/30 p-2 text-white backdrop-blur-sm transition hover:bg-black/50 disabled:opacity-0 sm:flex"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => scrollToPhoto(photoIdx + 1)}
                            disabled={photoIdx === photos.length - 1}
                            aria-label="Next photo"
                            className="absolute right-2 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/30 p-2 text-white backdrop-blur-sm transition hover:bg-black/50 disabled:opacity-0 sm:flex"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    </>
                )}
            </div>

            <div className="mx-auto max-w-md px-5 pt-6">
                <div className="flex items-baseline gap-3">
                    <h1 className="font-serif text-4xl leading-tight">
                        {profile.display_name}
                    </h1>
                    <span className="text-xl text-muted-foreground">{profile.age}</span>
                </div>

                {profile.bio && (
                    <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90">
                        {profile.bio}
                    </p>
                )}
            </div>

            <div className="fixed inset-x-0 bottom-0 border-t border-border/60 bg-background/90 backdrop-blur-md">
                <div className="mx-auto flex max-w-md items-center gap-3 px-5 py-4">
                    <button
                        type="button"
                        onClick={() => {
                            // Connection request flow is wired in Step 7.
                            // For Step 6 we stub this as a visible no-op.
                            alert("Connection requests arrive in the next step.");
                        }}
                        className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground transition hover:opacity-90"
                    >
                        <Heart className="h-5 w-5" />
                        Connect
                    </button>
                </div>
            </div>
        </main>
    );
}
