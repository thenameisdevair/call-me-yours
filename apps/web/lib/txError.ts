// Transaction-error normalizer for MiniPay / Celo writes.
//
// Goal: surface the actual error — never rewrite it into a guess. The only
// transformations we do are:
//   1. User-rejection (EIP-1193 code 4001) → friendly "you cancelled" copy.
//   2. Append an accurate hint for a small number of specific, well-known
//      wallet errors (code 4100 unauthorized, code 4902 wrong chain). These
//      hints are additive — the raw text is always present.
// Everything else passes through verbatim so the real cause is visible.

export type TxFlow = "accept" | "decline" | "send" | "gift" | "milestone";
export type TxStep = string;

interface Extracted {
    code: number | null;
    top: string;
    short: string | null;
    details: string | null;
    name: string | null;
    all: string[];
}

function extract(e: unknown): Extracted {
    const seen = new Set<unknown>();
    const all: string[] = [];
    let cur: unknown = e;
    let short: string | null = null;
    let details: string | null = null;
    let name: string | null = null;
    let code: number | null = null;
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
            if (typeof o.name === "string" && !name) name = o.name;
            if (typeof o.code === "number" && code === null) code = o.code;
            const data = o.data;
            if (data && typeof data === "object") {
                const dm = (data as Record<string, unknown>).message;
                if (typeof dm === "string") all.push(dm);
                const dc = (data as Record<string, unknown>).code;
                if (typeof dc === "number" && code === null) code = dc;
            }
            cur = o.cause;
        } else {
            break;
        }
    }

    if (!top && typeof e === "string") top = e;
    if (!top) top = "Something went wrong";
    return { code, top, short, details, name, all };
}

export function isUserRejection(e: unknown): boolean {
    const { code, all, name } = extract(e);
    if (code === 4001) return true;
    if (name === "UserRejectedRequestError") return true;
    // Fallback for wallets that don't set code: tight regex on wording.
    const needle =
        /user rejected|user denied|rejected the request|user cancel?led/i;
    return all.some((m) => needle.test(m));
}

export function formatTxError(step: TxStep, e: unknown, _flow: TxFlow = "send"): string {
    if (isUserRejection(e)) {
        return "You cancelled the confirmation in your wallet.";
    }

    const { code, top, short, details, name } = extract(e);
    const best = short ?? details ?? top;

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

    const codeTag = code !== null ? ` [${code}]` : "";
    const nameTag = name && name !== "Error" ? ` (${name})` : "";
    let msg = `${prefix}${codeTag}${nameTag}: ${best}`;

    // Actionable, code-specific hints. Additive only — raw text stays above.
    if (code === 4100 || name === "UnauthorizedProviderError") {
        msg +=
            "\n\nThis usually means MiniPay is signed into a different wallet than the one this account is tied to. Close and reopen Call Me Yours from inside MiniPay so it re-authorizes, then try again.";
    } else if (code === 4902) {
        msg +=
            "\n\nYour wallet isn't on the Celo network. Switch to Celo and try again.";
    }

    return msg;
}
