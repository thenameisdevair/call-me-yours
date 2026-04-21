"use client";

import { Sparkles, X } from "lucide-react";
import type { TriggeredMilestone } from "@/lib/milestoneEngine";

interface Props {
    milestone: TriggeredMilestone;
    onFulfill: (id: string) => void;
    onDismiss: (id: string) => void;
}

// Celebratory, non-intrusive milestone surface. Appears as a warm card over
// the chat. It offers — never demands — a gift. "Maybe Later" dismisses it
// without recording anything further; the milestone row already exists in
// Supabase, so this is purely a UI gesture.
export function MilestoneNotification({
    milestone,
    onFulfill,
    onDismiss,
}: Props) {
    const { id, def } = milestone;

    return (
        <div
            role="dialog"
            aria-live="polite"
            aria-label={`Milestone reached: ${def.name}`}
            className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-3xl border border-primary/20 bg-card shadow-2xl"
        >
            <div className="relative bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-5 pb-4 pt-6">
                <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={() => onDismiss(id)}
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
                >
                    <X className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-primary">
                    <Sparkles className="h-4 w-4" />
                    <span>Milestone reached</span>
                </div>
                <div className="mt-2 font-serif text-3xl leading-tight">
                    {def.name}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                    {def.description}
                </p>
            </div>
            <div className="border-t border-border px-5 py-4">
                <p className="text-xs text-muted-foreground">
                    {def.suggestion}
                </p>
                <div className="mt-3 flex gap-2">
                    <button
                        type="button"
                        onClick={() => onFulfill(id)}
                        className="flex-1 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                    >
                        Send a gift
                    </button>
                    <button
                        type="button"
                        onClick={() => onDismiss(id)}
                        className="rounded-full border border-border px-4 py-2.5 text-sm text-muted-foreground hover:border-foreground hover:text-foreground"
                    >
                        Maybe later
                    </button>
                </div>
            </div>
        </div>
    );
}
