import { encodeFunctionData, getAddress, type Address, type Hash } from "viem";
import { celo } from "viem/chains";
import { getWalletClient, USDM_ADAPTER, USDM_ADDRESS } from "./viem";

export const CMY_ADDRESS = process.env.NEXT_PUBLIC_CMY_CONTRACT_ADDRESS as Address;

// Minimal ABI covering the functions the app calls directly. The full ABI
// (including events) will be imported from the compiled Foundry artifact in
// later steps — for now the app only needs write functions + ERC20 approve.
export const CMY_ABI = [
    {
        type: "function",
        name: "sendConnectionRequest",
        stateMutability: "nonpayable",
        inputs: [{ name: "recipient", type: "address" }],
        outputs: [],
    },
    {
        type: "function",
        name: "acceptRequest",
        stateMutability: "nonpayable",
        inputs: [{ name: "sender", type: "address" }],
        outputs: [],
    },
    {
        type: "function",
        name: "declineRequest",
        stateMutability: "nonpayable",
        inputs: [{ name: "sender", type: "address" }],
        outputs: [],
    },
    {
        type: "function",
        name: "sendGift",
        stateMutability: "nonpayable",
        inputs: [
            { name: "recipient", type: "address" },
            { name: "giftType", type: "string" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [],
    },
    {
        type: "function",
        name: "recordMilestone",
        stateMutability: "nonpayable",
        inputs: [
            { name: "matchPartner", type: "address" },
            { name: "milestoneId", type: "string" },
        ],
        outputs: [],
    },
    {
        type: "function",
        name: "connectionFee",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
] as const;

export const USDM_ERC20_ABI = [
    {
        type: "function",
        name: "approve",
        stateMutability: "nonpayable",
        inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
    },
    {
        type: "function",
        name: "allowance",
        stateMutability: "view",
        inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
        ],
        outputs: [{ name: "", type: "uint256" }],
    },
] as const;

// All writes use legacy tx + feeCurrency USDM_ADAPTER so users pay gas in
// USDm. This is the CMY non-negotiable rule.
//
// "Permission denied" (EIP-1193 code 4100 / viem UnauthorizedProviderError)
// from MiniPay means the provider hasn't authorized the `from` account for
// eth_sendTransaction. useMiniPay only calls eth_requestAccounts once at
// mount; if the session drifts (chain switch, long-lived tab, wallet-side
// re-auth) the cached address becomes stale. Before every write we re-query
// the provider's live accounts and fail fast with a clear message if the
// caller's account isn't the one the wallet currently authorizes. This also
// re-primes MiniPay for the pending sendTransaction call on wallets that
// scope authorization per-request.
async function writeContract(
    account: Address,
    address: Address,
    data: `0x${string}`,
): Promise<Hash> {
    if (typeof window === "undefined" || !window.ethereum) {
        throw new Error("No injected wallet found");
    }

    // Re-auth & verify the live account matches what we're about to sign for.
    const live = (await window.ethereum.request({
        method: "eth_requestAccounts",
    })) as string[];
    const liveAddr = (live?.[0] ?? "").toLowerCase();
    const wanted = account.toLowerCase();
    if (!liveAddr) {
        throw new Error(
            "MiniPay didn't return an authorized account. Reopen Call Me Yours from inside MiniPay and try again.",
        );
    }
    if (liveAddr !== wanted) {
        throw new Error(
            `Wallet account mismatch. MiniPay is signed in as ${liveAddr} but this action is for ${wanted}. Close and reopen Call Me Yours in MiniPay so it refreshes the active account.`,
        );
    }

    const wallet = getWalletClient();
    const tx = {
        account,
        chain: celo,
        to: address,
        data,
        type: "legacy" as const,
        feeCurrency: USDM_ADAPTER,
    };
    // Keep the tx dump while we're stabilizing the MiniPay write path; it's
    // cheap and high-signal when an error surfaces. Remove once stable.
    // eslint-disable-next-line no-console
    console.log("[writeContract] sending tx:", {
        account: tx.account,
        chain: tx.chain.id,
        to: tx.to,
        data: tx.data,
        type: tx.type,
        feeCurrency: tx.feeCurrency,
        liveAddr,
    });
    return wallet.sendTransaction(tx);
}

export async function approveUSDm(account: Address, amount: bigint): Promise<Hash> {
    const data = encodeFunctionData({
        abi: USDM_ERC20_ABI,
        functionName: "approve",
        args: [CMY_ADDRESS, amount],
    });
    return writeContract(account, USDM_ADDRESS, data);
}

// Every address handed to encodeFunctionData is normalized through
// viem.getAddress() first. Addresses in CMY are stored lowercased in Supabase
// and the DB convention matches what the contract emits, but viem rejects
// mixed-case non-checksummed addresses (e.g. the sender's wallet hex copied
// verbatim from an explorer), so normalizing at the boundary keeps the call
// site forgiving. getAddress() also validates the hex length and chars.
export async function sendConnectionRequest(
    account: Address,
    recipient: Address,
): Promise<Hash> {
    const data = encodeFunctionData({
        abi: CMY_ABI,
        functionName: "sendConnectionRequest",
        args: [getAddress(recipient)],
    });
    return writeContract(getAddress(account), CMY_ADDRESS, data);
}

export async function acceptRequest(account: Address, sender: Address): Promise<Hash> {
    const data = encodeFunctionData({
        abi: CMY_ABI,
        functionName: "acceptRequest",
        args: [getAddress(sender)],
    });
    return writeContract(getAddress(account), CMY_ADDRESS, data);
}

export async function declineRequest(account: Address, sender: Address): Promise<Hash> {
    const data = encodeFunctionData({
        abi: CMY_ABI,
        functionName: "declineRequest",
        args: [getAddress(sender)],
    });
    return writeContract(getAddress(account), CMY_ADDRESS, data);
}

export async function sendGift(
    account: Address,
    recipient: Address,
    giftType: string,
    amount: bigint,
): Promise<Hash> {
    const data = encodeFunctionData({
        abi: CMY_ABI,
        functionName: "sendGift",
        args: [getAddress(recipient), giftType, amount],
    });
    return writeContract(getAddress(account), CMY_ADDRESS, data);
}

export async function recordMilestone(
    account: Address,
    matchPartner: Address,
    milestoneId: string,
): Promise<Hash> {
    const data = encodeFunctionData({
        abi: CMY_ABI,
        functionName: "recordMilestone",
        args: [getAddress(matchPartner), milestoneId],
    });
    return writeContract(getAddress(account), CMY_ADDRESS, data);
}
