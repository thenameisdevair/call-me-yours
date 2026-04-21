"use client";

import { CheckCircle2, Loader2, Wallet, X } from "lucide-react";
import { useState } from "react";
import type { Address } from "viem";
import { GIFTS, type Gift } from "@/constants/gifts";
import { useGiftSend } from "@/hooks/useGiftSend";

const MINIPAY_ADD_CASH_URL = "https://minipay.opera.com/add_cash";

interface Props {
    open: boolean;
    onClose: () => void;
    sender: Address | null | undefined;
    recipient: Address | null | undefined;
    matchId: string | null;
    recipientName: string;
    // If the catalogue was opened from a milestone notification, this is the
    // milestone the gift should fulfill. The hook writes the fulfillment to
    // Supabase and records it on-chain.
    fulfillMilestoneId?: string | null;
    onSent?: (sent: {
        gift: Gift;
        txHash: string;
        amountWei: bigint;
    }) => void;
}

// Full gift catalogue surface: sheet of 5 gifts → confirmation → flow states.
// Co-locates all gift UI so chat/milestone callers just mount this component.
export function GiftCatalogue({
    open,
    onClose,
    sender,
    recipient,
    matchId,
    recipientName,
    fulfillMilestoneId,
    onSent,
}: Props) {
    const [selected, setSelected] = useState<Gift | null>(null);
    const { step, error, balanceDisplay, send, reset } = useGiftSend({
        sender,
        recipient,
        matchId,
    });

    if (!open) return null;

    const closeAndReset = () => {
        setSelected(null);
        reset();
        onClose();
    };

    const onConfirm = async () => {
        if (!selected) return;
        const result = await send(selected, fulfillMilestoneId ?? null);
        if (result) {
            onSent?.({
                gift: selected,
                txHash: result.txHash,
                amountWei: result.amountWei,
            });
        }
    };

    const busy =
        step === "checking-balance" ||
        step === "approving" ||
        step === "sending" ||
        step === "recording";

    return (
        <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center"
            onClick={(e) => {
                if (e.target === e.currentTarget && !busy) closeAndReset();
            }}
        >
            <div className="relative w-full max-w-md rounded-t-3xl bg-background p-5 shadow-2xl sm:rounded-3xl">
                <div className="mb-3 flex items-center justify-between">
                    <div>
                        <div className="font-serif text-2xl leading-tight">
                            Send a gift
                        </div>
                        <div className="text-xs text-muted-foreground">
                            To {recipientName} — recipient keeps 100%.
                        </div>
                    </div>
                    {!busy && (
                        <button
                            type="button"
                            aria-label="Close"
                            onClick={closeAndReset}
                            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {step === "success" ? (
                    <SuccessBody gift={selected} onClose={closeAndReset} />
                ) : step === "error" ? (
                    <ErrorBody
                        message={error}
                        onRetry={reset}
                        onClose={closeAndReset}
                    />
                ) : step === "insufficient-balance" ? (
                    <InsufficientBody
                        gift={selected}
                        balanceDisplay={balanceDisplay}
                        onClose={closeAndReset}
                    />
                ) : selected ? (
                    <ConfirmBody
                        gift={selected}
                        recipientName={recipientName}
                        step={step}
                        onBack={() => {
                            if (!busy) {
                                setSelected(null);
                                reset();
                            }
                        }}
                        onConfirm={onConfirm}
                    />
                ) : (
                    <CatalogueBody onPick={setSelected} />
                )}
            </div>
        </div>
    );
}

function CatalogueBody({ onPick }: { onPick: (g: Gift) => void }) {
    return (
        <ul className="grid grid-cols-2 gap-3 pb-2">
            {GIFTS.map((gift) => (
                <li key={gift.id}>
                    <button
                        type="button"
                        onClick={() => onPick(gift)}
                        className="flex h-full w-full flex-col items-center gap-1 rounded-2xl border border-border bg-card px-3 py-4 text-center transition hover:border-primary hover:bg-primary/5"
                    >
                        <span className="text-4xl" aria-hidden>
                            {gift.emoji}
                        </span>
                        <span className="mt-1 font-serif text-lg leading-tight">
                            {gift.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {gift.description}
                        </span>
                        <span className="mt-1 rounded-full bg-primary/10 px-3 py-0.5 text-sm font-semibold text-primary">
                            {gift.priceDisplay} USDm
                        </span>
                    </button>
                </li>
            ))}
        </ul>
    );
}

function ConfirmBody({
    gift,
    recipientName,
    step,
    onBack,
    onConfirm,
}: {
    gift: Gift;
    recipientName: string;
    step: GiftStepLike;
    onBack: () => void;
    onConfirm: () => void;
}) {
    const busy =
        step === "checking-balance" ||
        step === "approving" ||
        step === "sending" ||
        step === "recording";

    const busyLabel =
        step === "approving"
            ? "Approving USDm…"
            : step === "sending"
              ? "Sending gift…"
              : step === "recording"
                ? "Almost done…"
                : "Checking balance…";

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/30 px-4 py-3">
                <span className="text-4xl" aria-hidden>
                    {gift.emoji}
                </span>
                <div className="flex-1">
                    <div className="font-serif text-xl leading-tight">
                        {gift.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                        To {recipientName}
                    </div>
                </div>
                <div className="text-right">
                    <div className="font-serif text-xl leading-tight">
                        {gift.priceDisplay}
                    </div>
                    <div className="text-xs text-muted-foreground">USDm</div>
                </div>
            </div>
            <p className="text-xs text-muted-foreground">
                Send {gift.name.toLowerCase()} worth {gift.priceDisplay} USDm?
                {recipientName} receives the full amount.
            </p>
            <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground transition disabled:opacity-60"
            >
                {busy ? (
                    <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        {busyLabel}
                    </>
                ) : (
                    <>Confirm & send {gift.priceDisplay} USDm</>
                )}
            </button>
            <button
                type="button"
                onClick={onBack}
                disabled={busy}
                className="text-sm text-muted-foreground"
            >
                Back
            </button>
        </div>
    );
}

function InsufficientBody({
    gift,
    balanceDisplay,
    onClose,
}: {
    gift: Gift | null;
    balanceDisplay: string | null;
    onClose: () => void;
}) {
    return (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
            <Wallet className="h-8 w-8 text-primary" />
            <h3 className="font-serif text-2xl">Not enough USDm</h3>
            <p className="text-sm text-muted-foreground">
                {gift ? (
                    <>
                        Sending {gift.name} costs{" "}
                        <span className="font-semibold text-foreground">
                            {gift.priceDisplay} USDm
                        </span>
                        .{" "}
                    </>
                ) : null}
                Your balance is {balanceDisplay ?? "0"} USDm.
            </p>
            <a
                href={MINIPAY_ADD_CASH_URL}
                className="mt-1 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
                Add cash in MiniPay
            </a>
            <button
                type="button"
                onClick={onClose}
                className="text-sm text-muted-foreground"
            >
                Not now
            </button>
        </div>
    );
}

function SuccessBody({
    gift,
    onClose,
}: {
    gift: Gift | null;
    onClose: () => void;
}) {
    const confetti = [
        { dx: "-48px", dy: "-96px", r: "-40deg", delay: "0ms" },
        { dx: "52px", dy: "-110px", r: "60deg", delay: "60ms" },
        { dx: "-12px", dy: "-140px", r: "10deg", delay: "30ms" },
        { dx: "36px", dy: "-72px", r: "180deg", delay: "100ms" },
        { dx: "-60px", dy: "-60px", r: "-120deg", delay: "140ms" },
    ];
    return (
        <div className="relative flex flex-col items-center gap-3 py-4 text-center">
            <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
                {confetti.map((c, i) => (
                    <span
                        key={i}
                        aria-hidden
                        className="animate-confetti absolute text-lg"
                        style={{
                            // @ts-expect-error css vars
                            "--dx": c.dx,
                            "--dy": c.dy,
                            "--r": c.r,
                            animationDelay: c.delay,
                        }}
                    >
                        {["✦", "✧", "❤", "✿", "★"][i]}
                    </span>
                ))}
            </div>
            <div className="animate-pop relative">
                {gift ? (
                    <span className="text-5xl" aria-hidden>
                        {gift.emoji}
                    </span>
                ) : (
                    <CheckCircle2 className="h-10 w-10 text-primary" />
                )}
            </div>
            <h3 className="font-serif text-3xl">Gift sent</h3>
            {gift && (
                <p className="text-sm text-muted-foreground">
                    {gift.name} — {gift.priceDisplay} USDm is on its way.
                </p>
            )}
            <button
                type="button"
                onClick={onClose}
                className="mt-1 h-11 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
                Back to chat
            </button>
        </div>
    );
}

function ErrorBody({
    message,
    onRetry,
    onClose,
}: {
    message: string | null;
    onRetry: () => void;
    onClose: () => void;
}) {
    return (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
            <h3 className="font-serif text-2xl">Couldn&apos;t send</h3>
            <p className="text-sm text-muted-foreground">
                {message ?? "Something went wrong. Please try again."}
            </p>
            <div className="mt-1 flex w-full gap-2">
                <button
                    type="button"
                    onClick={onClose}
                    className="h-11 flex-1 rounded-xl border border-border text-sm text-muted-foreground"
                >
                    Close
                </button>
                <button
                    type="button"
                    onClick={onRetry}
                    className="h-11 flex-1 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
                >
                    Try again
                </button>
            </div>
        </div>
    );
}

type GiftStepLike =
    | "idle"
    | "checking-balance"
    | "insufficient-balance"
    | "approving"
    | "sending"
    | "recording"
    | "success"
    | "error";
