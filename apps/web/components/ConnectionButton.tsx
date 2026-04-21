"use client";

import { CheckCircle2, Heart, Loader2, Wallet, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { Address } from "viem";
import {
    MINIPAY_ADD_CASH_URL,
    useConnectionRequest,
} from "@/hooks/useConnectionRequest";

interface Props {
    sender: Address | null | undefined;
    recipient: Address;
    recipientName: string;
    alreadyRequested?: boolean;
}

// Full connection-request surface: the bottom-docked "Connect" button plus
// every modal state in the flow. Keeps all user-visible chrome for the flow
// co-located so /profile/[address] only needs to mount this one component.
export default function ConnectionButton({
    sender,
    recipient,
    recipientName,
    alreadyRequested,
}: Props) {
    const router = useRouter();
    const {
        step,
        error,
        feeDisplay,
        balanceDisplay,
        start,
        confirm,
        cancel,
        reset,
    } = useConnectionRequest({ sender, recipient });

    const disabled =
        alreadyRequested ||
        !sender ||
        step === "checking-balance" ||
        step === "approving" ||
        step === "sending" ||
        step === "recording";

    // Lock background scroll whenever any modal is showing.
    useEffect(() => {
        if (step === "idle" || step === "checking-balance") return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [step]);

    return (
        <>
            <button
                type="button"
                onClick={start}
                disabled={disabled}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
                {step === "checking-balance" ? (
                    <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Checking balance
                    </>
                ) : alreadyRequested ? (
                    <>
                        <CheckCircle2 className="h-5 w-5" />
                        Request sent
                    </>
                ) : (
                    <>
                        <Heart className="h-5 w-5" />
                        Connect
                    </>
                )}
            </button>

            {step === "insufficient-balance" && (
                <Modal onClose={reset}>
                    <div className="flex flex-col items-center gap-3 text-center">
                        <Wallet className="h-8 w-8 text-primary" />
                        <h2 className="font-serif text-2xl">Not enough USDm</h2>
                        <p className="text-sm text-muted-foreground">
                            Sending a connection request costs{" "}
                            <span className="font-semibold text-foreground">
                                {feeDisplay} USDm
                            </span>
                            . Your balance is {balanceDisplay ?? "0"} USDm.
                        </p>
                        <a
                            href={MINIPAY_ADD_CASH_URL}
                            className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
                        >
                            Add cash in MiniPay
                        </a>
                        <button
                            type="button"
                            onClick={reset}
                            className="text-sm text-muted-foreground underline-offset-2 hover:underline"
                        >
                            Not now
                        </button>
                    </div>
                </Modal>
            )}

            {step === "awaiting-confirmation" && (
                <Modal onClose={cancel}>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col items-center gap-2 text-center">
                            <Heart className="h-8 w-8 text-primary" />
                            <h2 className="font-serif text-2xl">
                                Send a request to {recipientName}?
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                A small fee keeps Call Me Yours spam-free. You only pay
                                if the request is sent.
                            </p>
                        </div>
                        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                            <div className="flex items-baseline justify-between">
                                <span className="text-sm text-muted-foreground">
                                    Connection fee
                                </span>
                                <span className="font-serif text-2xl">
                                    {feeDisplay} <span className="text-base">USDm</span>
                                </span>
                            </div>
                            <div className="mt-1 flex items-baseline justify-between text-xs text-muted-foreground">
                                <span>Your balance</span>
                                <span>{balanceDisplay} USDm</span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={confirm}
                            className="h-12 rounded-xl bg-primary text-base font-semibold text-primary-foreground transition hover:opacity-90"
                        >
                            Confirm & send {feeDisplay} USDm
                        </button>
                        <button
                            type="button"
                            onClick={cancel}
                            className="text-sm text-muted-foreground"
                        >
                            Cancel
                        </button>
                    </div>
                </Modal>
            )}

            {(step === "approving" || step === "sending" || step === "recording") && (
                <Modal>
                    <div className="flex flex-col items-center gap-3 py-4 text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <h2 className="font-serif text-2xl">
                            {step === "approving"
                                ? "Approving USDm…"
                                : step === "sending"
                                  ? "Sending request…"
                                  : "Almost there…"}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            {step === "approving"
                                ? "Confirm the approval in MiniPay."
                                : step === "sending"
                                  ? "Confirm the transaction in MiniPay."
                                  : "Saving your request."}
                        </p>
                    </div>
                </Modal>
            )}

            {step === "success" && (
                <Modal onClose={() => router.push("/discover")}>
                    <div className="flex flex-col items-center gap-3 text-center">
                        <CheckCircle2 className="h-10 w-10 text-primary" />
                        <h2 className="font-serif text-3xl">Request sent</h2>
                        <p className="text-sm text-muted-foreground">
                            We&apos;ll let you know when {recipientName} responds.
                        </p>
                        <button
                            type="button"
                            onClick={() => router.push("/discover")}
                            className="mt-2 h-11 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
                        >
                            Back to discover
                        </button>
                    </div>
                </Modal>
            )}

            {step === "error" && (
                <Modal onClose={reset}>
                    <div className="flex flex-col items-center gap-3 text-center">
                        <h2 className="font-serif text-2xl">Couldn&apos;t send</h2>
                        <p className="text-sm text-muted-foreground">
                            {error ?? "Something went wrong. Please try again."}
                        </p>
                        <button
                            type="button"
                            onClick={reset}
                            className="mt-2 h-11 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
                        >
                            Close
                        </button>
                    </div>
                </Modal>
            )}
        </>
    );
}

function Modal({
    children,
    onClose,
}: {
    children: React.ReactNode;
    onClose?: () => void;
}) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-4 pt-16 sm:items-center sm:pb-10"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose?.();
            }}
        >
            <div className="relative w-full max-w-sm rounded-2xl bg-background p-6 shadow-xl">
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
                {children}
            </div>
        </div>
    );
}
