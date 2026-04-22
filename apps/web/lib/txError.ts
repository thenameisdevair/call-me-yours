// Shared transaction-error normalizer for MiniPay / Celo writes.
//
// viem wraps RPC / wallet errors in nested `cause` chains; the surface
// `error.message` is often the opaque top-level ("An unknown RPC error
// occurred.") while the actionable text lives several layers down in
// `shortMessage` / `details` / `data.message`. This walks the chain, picks
// the most specific string, and maps known node-level failure modes to
// something a user can act on.

export type TxFlow = "accept" | "decline" | "send" | "gift" | "milestone";

export type TxStep = string;

interface ExtractedError {
    top: string;
    short: string | null;
    details: string | null;
    all: string[];
}

function extract(e: unknown): ExtractedError {
    const seen = new Set<unknown>();
    const all: string[] = [];
    let cur: unknown = e;
    let short: string | null = null;
    let details: string | null = null;
    let top = "";

    while (cur && !seen.has(cur)) {
        seen.add(cur);
        if (typeof cur === "object" && cur !== null) {
            const o = cur as Record<string, unknown>;
            if (typeof o.message === "string") {
                if (!top) top = o.message;
                all.push(o.message);
            }
            if (typeof o.shortMessage === "string") {
                short ??= o.shortMessage;
                all.push(o.shortMessage);
            }
            if (typeof o.details === "string") {
                details ??= o.details;
                all.push(o.details);
            }
            const data = o.data;
            if (data && typeof data === "object") {
                const dm = (data as Record<string, unknown>).message;
                if (typeof dm === "string") all.push(dm);
            }
            cur = o.cause;
        } else {
            break;
        }
    }

    if (!top && typeof e === "string") top = e;
    if (!top) top = "Something went wrong";
    return { top, short, details, all };
}

export function isUserRejection(e: unknown): boolean {
    const { all } = extract(e);
    // Tight: only match wording MiniPay / injected wallets actually use when
    // the user dismisses the sheet. Do NOT match bare "denied" — Celo node
    // rejects come back as "Permission denied" and are NOT user cancels.
    const needle =
        /user rejected|user denied|rejected the request|user cancel?led/i;
    return all.some((m) => needle.test(m));
}

export function isFeeCurrencyError(e: unknown): boolean {
    const { all } = extract(e);
    // Celo node replies with "Permission denied" / "insufficient funds for
    // gas" / "fee currency not whitelisted" / "gateway fee" depending on
    // version when the `feeCurrency` is wrong, unregistered, or the wallet
    // has no balance of it to cover gas.
    const needle =
        /permission denied|fee currency|feecurrency|not whitelisted|insufficient funds for gas|gateway fee/i;
    return all.some((m) => needle.test(m));
}

export function formatTxError(
    step: TxStep,
    e: unknown,
    _flow: TxFlow = "send",
): string {
    if (isUserRejection(e)) {
        return "You cancelled the confirmation in your wallet.";
    }

    const { top, short, details } = extract(e);
    const best = short ?? details ?? top;

    if (isFeeCurrencyError(e)) {
        // Gas on Celo is paid in USDm here; the node refuses the tx when the
        // fee currency isn't accepted or the wallet has no USDm at all. Make
        // the remedy concrete.
        return (
            "Celo couldn't charge gas in USDm for this transaction. " +
            "Make sure your MiniPay wallet has a small USDm balance (even " +
            "a few cents covers gas), then try again."
        );
    }

    const prefix =
        step === "tx"
            ? "Wallet error"
            : step === "confirm"
              ? "Transaction did not confirm"
              : step === "match"
                ? "Could not save the match"
                : step === "update"
                  ? "Could not update the request"
                  : step === "preflight"
                    ? "Can't start this transaction"
                    : "Something went wrong";

    return `${prefix}: ${best}`;
}
