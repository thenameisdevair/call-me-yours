"use client";

import { ArrowLeft, Heart } from "lucide-react";
import Link from "next/link";

// Placeholder page — the full matches list with XMTP last-message previews is
// built in Step 8 (feat/xmtp-chat). Keeping the route alive avoids a 404 after
// accepting a connection request in Step 7.
export default function MatchesPage() {
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
                    <h1 className="font-serif text-4xl leading-tight">Matches</h1>
                </header>
                <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
                    <Heart className="h-8 w-8 text-primary" />
                    <div className="font-serif text-3xl">It&apos;s a match</div>
                    <p className="max-w-xs text-sm text-muted-foreground">
                        Chat arrives in the next update. For now, your matches are safe
                        and waiting.
                    </p>
                </div>
            </div>
        </main>
    );
}
