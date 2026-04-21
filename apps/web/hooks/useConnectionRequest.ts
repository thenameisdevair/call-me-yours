"use client";

import { useCallback, useEffect, useState } from "react";
import { type Address, formatUnits } from "viem";
import {
    approveUSDm,
    CMY_ABI,
    CMY_ADDRESS,
    sendConnectionRequest as sendConnectionTx,
    USDM_ERC20_ABI,
} from "@/lib/contracts";
import {
    checkTransactionSuccess,
    checkUSDmBalance,
    publicClient,
    USDM_ADDRESS,
} from "@/lib/viem";
import { getSupabase } from "@/lib/supabase";

export type ConnectionStep =
    | "idle"
    | "checking-balance"
    | "insufficient-balance"
    | "awaiting-confirmation"
    | "approving"
    | "sending"
    | "recording"
    | "success"
    | "error";

export const MINIPAY_ADD_CASH_URL = "https://minipay.opera.com/add_cash";

interface UseConnectionRequestArgs {
    sender: Address | null | undefined;
    recipient: Address | null | undefined;
}

interface UseConnectionRequestResult {
    step: ConnectionStep;
    error: string | null;
    // Formatted fee string (e.g. "0.05") for the confirmation modal.
    feeDisplay: string | null;
    feeWei: bigint | null;
    balanceDisplay: string | null;
    start: () => Promise<void>;
    confirm: () => Promise<void>;
    cancel: () => void;
    reset: () => void;
}

// Reads CMY.connectionFee on mount so the UI always displays the exact
// current fee — never a hard-coded value. Encapsulates the full flow:
// balance check → confirmation → (approve if needed) → on-chain tx →
// Supabase write. Supabase is only touched after on-chain success.
export function useConnectionRequest({
    sender,
    recipient,
}: UseConnectionRequestArgs): UseConnectionRequestResult {
    const [step, setStep] = useState<ConnectionStep>("idle");
    const [error, setError] = useState<string | null>(null);
    const [feeWei, setFeeWei] = useState<bigint | null>(null);
    const [balanceWei, setBalanceWei] = useState<bigint | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const fee = (await publicClient.readContract({
                    address: CMY_ADDRESS,
                    abi: CMY_ABI,
                    functionName: "connectionFee",
                })) as bigint;
                if (!cancelled) setFeeWei(fee);
            } catch {
                // Leave feeWei null — caller will surface the failure when start() runs.
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const reset = useCallback(() => {
        setStep("idle");
        setError(null);
    }, []);

    const cancel = useCallback(() => {
        setStep("idle");
        setError(null);
    }, []);

    const start = useCallback(async () => {
        if (!sender || !recipient) {
            setError("Wallet not ready");
            setStep("error");
            return;
        }
        if (sender.toLowerCase() === recipient.toLowerCase()) {
            setError("You can't connect with yourself");
            setStep("error");
            return;
        }
        setError(null);
        setStep("checking-balance");
        try {
            if (feeWei == null) {
                throw new Error("Unable to read connection fee — try again in a moment");
            }
            const balance = await checkUSDmBalance(sender);
            setBalanceWei(balance);
            if (balance < feeWei) {
                setStep("insufficient-balance");
                return;
            }
            setStep("awaiting-confirmation");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not check balance");
            setStep("error");
        }
    }, [sender, recipient, feeWei]);

    const confirm = useCallback(async () => {
        if (!sender || !recipient || feeWei == null) return;
        try {
            // Approve CMY to pull the fee if allowance is insufficient.
            const allowance = (await publicClient.readContract({
                address: USDM_ADDRESS,
                abi: USDM_ERC20_ABI,
                functionName: "allowance",
                args: [sender, CMY_ADDRESS],
            })) as bigint;

            if (allowance < feeWei) {
                setStep("approving");
                const approveHash = await approveUSDm(sender, feeWei);
                const ok = await checkTransactionSuccess(approveHash);
                if (!ok) throw new Error("USDm approval failed");
            }

            setStep("sending");
            const txHash = await sendConnectionTx(sender, recipient);
            const success = await checkTransactionSuccess(txHash);
            if (!success) throw new Error("Transaction failed on-chain");

            setStep("recording");
            const supabase = getSupabase();
            const { error: insertErr } = await supabase
                .from("connection_requests")
                .insert({
                    sender: sender.toLowerCase(),
                    recipient: recipient.toLowerCase(),
                    fee_tx_hash: txHash,
                    status: "pending",
                });
            if (insertErr) throw insertErr;

            setStep("success");
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Something went wrong";
            // User rejections in MiniPay come back as errors — treat them as a
            // return to idle rather than a hard error screen.
            if (/reject|denied|cancel/i.test(msg)) {
                setStep("awaiting-confirmation");
                setError(null);
                return;
            }
            setError(msg);
            setStep("error");
        }
    }, [sender, recipient, feeWei]);

    const feeDisplay = feeWei != null ? formatUnits(feeWei, 18) : null;
    const balanceDisplay = balanceWei != null ? formatUnits(balanceWei, 18) : null;

    return {
        step,
        error,
        feeDisplay,
        feeWei,
        balanceDisplay,
        start,
        confirm,
        cancel,
        reset,
    };
}
