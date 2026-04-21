import { parseUnits } from "viem";

// CMY V1 gift catalogue. Prices are fixed platform-defined values. The
// recipient always receives 100% of `priceWei` — the platform margin lives
// in the price itself, not in a post-transfer deduction.
//
// USDm has 18 decimals (ERC-20 on Celo). Keeping priceWei pre-computed
// means every callsite uses the same literal and we never risk a floating
// point error converting a "0.50" string mid-transaction.

export interface Gift {
    id: "GF-01" | "GF-02" | "GF-03" | "GF-04" | "GF-05";
    name: string;
    description: string;
    emoji: string;
    priceDisplay: string;
    priceWei: bigint;
}

export const GIFTS: Gift[] = [
    {
        id: "GF-01",
        name: "Warm Heart",
        description: "A gentle hello.",
        emoji: "💛",
        priceDisplay: "0.50",
        priceWei: parseUnits("0.5", 18),
    },
    {
        id: "GF-02",
        name: "Red Rose",
        description: "A classic gesture.",
        emoji: "🌹",
        priceDisplay: "1.00",
        priceWei: parseUnits("1", 18),
    },
    {
        id: "GF-03",
        name: "Sweet Candy",
        description: "A small delight.",
        emoji: "🍬",
        priceDisplay: "1.50",
        priceWei: parseUnits("1.5", 18),
    },
    {
        id: "GF-04",
        name: "Gold Star",
        description: "You earned this.",
        emoji: "⭐",
        priceDisplay: "2.00",
        priceWei: parseUnits("2", 18),
    },
    {
        id: "GF-05",
        name: "Diamond Ring",
        description: "The big one.",
        emoji: "💎",
        priceDisplay: "5.00",
        priceWei: parseUnits("5", 18),
    },
];

export const GIFTS_BY_ID: Record<string, Gift> = Object.fromEntries(
    GIFTS.map((g) => [g.id, g])
);

// Marker stored inside the XMTP text payload so the chat renderer can tell
// a gift apart from a regular text message without the server ever reading
// content. XMTP still E2E-encrypts the body — this is purely an on-wire
// convention between CMY clients.
export const GIFT_MESSAGE_MARKER = "__cmy_gift_v1";

export interface GiftPayload {
    [GIFT_MESSAGE_MARKER]: true;
    id: string;
    txHash: string;
    amountWei: string;
}

export function encodeGiftMessage(
    giftId: string,
    txHash: string,
    amountWei: bigint
): string {
    const payload: GiftPayload = {
        [GIFT_MESSAGE_MARKER]: true,
        id: giftId,
        txHash,
        amountWei: amountWei.toString(),
    };
    return JSON.stringify(payload);
}

export function decodeGiftMessage(text: string): GiftPayload | null {
    // Gifts always serialize to JSON starting with `{`. Skip the parse on
    // anything else so the hot path for plain text stays cheap.
    if (!text || text[0] !== "{") return null;
    try {
        const parsed = JSON.parse(text) as Partial<GiftPayload>;
        if (parsed[GIFT_MESSAGE_MARKER] !== true) return null;
        if (typeof parsed.id !== "string") return null;
        if (typeof parsed.txHash !== "string") return null;
        if (typeof parsed.amountWei !== "string") return null;
        return parsed as GiftPayload;
    } catch {
        return null;
    }
}
