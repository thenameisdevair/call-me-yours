"use client";

import { formatUnits } from "viem";
import { GIFTS_BY_ID } from "@/constants/gifts";

interface Props {
    giftId: string;
    amountWei: bigint;
    fromMe: boolean;
}

// Renders a gift inside the chat thread as a distinct visual element —
// never a generic transaction notification. A pill-style card with the
// gift's emoji, name, and USDm amount. Warm on both sides of the thread;
// the only differentiator is alignment so the sender still sees their own
// gift right-aligned like their text bubbles.
export function GiftMessage({ giftId, amountWei, fromMe }: Props) {
    const gift = GIFTS_BY_ID[giftId];
    const amount = formatUnits(amountWei, 18);
    const label = fromMe ? "You sent" : "You received";

    return (
        <div
            className={
                fromMe
                    ? "self-end max-w-[85%]"
                    : "self-start max-w-[85%]"
            }
        >
            <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-4 py-3 shadow-sm">
                <span className="text-3xl" aria-hidden>
                    {gift?.emoji ?? "🎁"}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase tracking-wide text-primary">
                        {label}
                    </div>
                    <div className="font-serif text-lg leading-tight">
                        {gift?.name ?? "A gift"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {amount} USDm
                    </div>
                </div>
            </div>
        </div>
    );
}
