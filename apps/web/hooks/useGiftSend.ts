"use client";

import { useCallback, useState } from "react";
import { type Address, formatUnits } from "viem";
import {
    approveUSDm,
    CMY_ADDRESS,
    recordMilestone as recordMilestoneTx,
    sendGift as sendGiftTx,
    USDM_ERC20_ABI,
} from "@/lib/contracts";
import {
    checkTransactionSuccess,
    checkUSDmBalance,
    publicClient,
    USDM_ADDRESS,
} from "@/lib/viem";
import { getSupabase } from "@/lib/supabase";
import type { Gift } from "@/constants/gifts";

export type GiftStep =
    | "idle"
    | "checking-balance"
    | "insufficient-balance"
    | "approving"
    | "sending"
    | "recording"
    | "success"
    | "error";

interface Args {
    sender: Address | null | undefined;
    recipient: Address | null | undefined;
    matchId: string | null;
}

interface SendResult {
    txHash: string;
    amountWei: bigint;
    firstGift: boolean;
    giftReturned: boolean;
}

interface UseGiftSendResult {
    step: GiftStep;
    error: string | null;
    balanceDisplay: string | null;
    send: (gift: Gift, fulfillMilestoneId?: string | null) => Promise<SendResult | null>;
    reset: () => void;
}

// Full gift-send flow — encapsulates balance → approve → on-chain transfer
// → post-transfer bookkeeping. The on-chain call uses the CMY contract so
// that the platform records (sender, recipient, giftType, amount); the
// recipient receives 100% of `amount`, never a deducted value.
//
// After a successful send the hook:
//   - Inserts MS-08 (First Gift Sent) into the milestones table if it has
//     not yet been recorded for this match.
//   - Inserts MS-09 (Gift Returned) when the gift makes the pair's gift
//     history bidirectional.
//   - If the caller passed `fulfillMilestoneId`, updates that milestone
//     row's fulfilled_by / fulfilled_at / gift_tx_hash columns AND records
//     the fulfillment on-chain via CMY.recordMilestone.
export function useGiftSend({
    sender,
    recipient,
    matchId,
}: Args): UseGiftSendResult {
    const [step, setStep] = useState<GiftStep>("idle");
    const [error, setError] = useState<string | null>(null);
    const [balanceWei, setBalanceWei] = useState<bigint | null>(null);

    const reset = useCallback(() => {
        setStep("idle");
        setError(null);
    }, []);

    const send = useCallback(
        async (gift: Gift, fulfillMilestoneId?: string | null) => {
            if (!sender || !recipient || !matchId) {
                setError("Wallet or match not ready");
                setStep("error");
                return null;
            }
            if (sender.toLowerCase() === recipient.toLowerCase()) {
                setError("Can't send a gift to yourself");
                setStep("error");
                return null;
            }

            setError(null);
            setStep("checking-balance");

            try {
                const balance = await checkUSDmBalance(sender);
                setBalanceWei(balance);
                if (balance < gift.priceWei) {
                    setStep("insufficient-balance");
                    return null;
                }

                // Approve CMY to pull `gift.priceWei` if allowance is short.
                const allowance = (await publicClient.readContract({
                    address: USDM_ADDRESS,
                    abi: USDM_ERC20_ABI,
                    functionName: "allowance",
                    args: [sender, CMY_ADDRESS],
                })) as bigint;

                if (allowance < gift.priceWei) {
                    setStep("approving");
                    const approveHash = await approveUSDm(sender, gift.priceWei);
                    const approveOk = await checkTransactionSuccess(approveHash);
                    if (!approveOk) throw new Error("USDm approval failed");
                }

                setStep("sending");
                const txHash = await sendGiftTx(
                    sender,
                    recipient,
                    gift.id,
                    gift.priceWei
                );
                const ok = await checkTransactionSuccess(txHash);
                if (!ok) throw new Error("Gift transaction failed on-chain");

                setStep("recording");

                const supabase = getSupabase();
                const senderLower = sender.toLowerCase();

                // Read existing milestones for this match so we can decide
                // whether this gift triggers MS-08 / MS-09.
                const { data: existing } = await supabase
                    .from("milestones")
                    .select("milestone_id, fulfilled_by, gift_tx_hash")
                    .eq("match_id", matchId);

                const existingIds = new Set(
                    (existing ?? []).map((r) => r.milestone_id)
                );
                const priorGiftSenders = new Set(
                    (existing ?? [])
                        .filter((r) => r.gift_tx_hash && r.fulfilled_by)
                        .map((r) => (r.fulfilled_by as string).toLowerCase())
                );

                const firstGift = !existingIds.has("MS-08");
                const giftReturned =
                    !existingIds.has("MS-09") &&
                    priorGiftSenders.size > 0 &&
                    !priorGiftSenders.has(senderLower);

                const nowIso = new Date().toISOString();
                const newRows: {
                    match_id: string;
                    milestone_id: string;
                    fulfilled_by: string;
                    fulfilled_at: string;
                    gift_tx_hash: string;
                }[] = [];
                if (firstGift) {
                    newRows.push({
                        match_id: matchId,
                        milestone_id: "MS-08",
                        fulfilled_by: senderLower,
                        fulfilled_at: nowIso,
                        gift_tx_hash: txHash,
                    });
                }
                if (giftReturned) {
                    newRows.push({
                        match_id: matchId,
                        milestone_id: "MS-09",
                        fulfilled_by: senderLower,
                        fulfilled_at: nowIso,
                        gift_tx_hash: txHash,
                    });
                }
                if (newRows.length) {
                    await supabase.from("milestones").upsert(newRows, {
                        onConflict: "match_id,milestone_id",
                        ignoreDuplicates: true,
                    });
                }

                // If this gift fulfills a pending milestone (passed from the
                // MilestoneNotification "Send a gift" action), mark the row
                // as fulfilled and record it on-chain. Fulfillment is
                // optional — we only do this when the caller opted in.
                if (fulfillMilestoneId) {
                    await supabase
                        .from("milestones")
                        .update({
                            fulfilled_by: senderLower,
                            fulfilled_at: nowIso,
                            gift_tx_hash: txHash,
                        })
                        .eq("match_id", matchId)
                        .eq("milestone_id", fulfillMilestoneId);

                    // Best-effort on-chain record. A failure here does not
                    // roll back the gift — the USDm has already moved. We
                    // surface the error but keep `success` as the terminal
                    // state because the gift itself succeeded.
                    try {
                        await recordMilestoneTx(
                            sender,
                            recipient,
                            fulfillMilestoneId
                        );
                    } catch (e) {
                        console.warn(
                            "on-chain recordMilestone failed",
                            e instanceof Error ? e.message : e
                        );
                    }
                }

                setStep("success");
                return {
                    txHash,
                    amountWei: gift.priceWei,
                    firstGift,
                    giftReturned,
                };
            } catch (e) {
                const msg =
                    e instanceof Error ? e.message : "Something went wrong";
                if (/reject|denied|cancel/i.test(msg)) {
                    setStep("idle");
                    setError(null);
                    return null;
                }
                setError(msg);
                setStep("error");
                return null;
            }
        },
        [sender, recipient, matchId]
    );

    return {
        step,
        error,
        balanceDisplay:
            balanceWei != null ? formatUnits(balanceWei, 18) : null,
        send,
        reset,
    };
}
