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
async function writeContract(
    account: Address,
    address: Address,
    data: `0x${string}`,
): Promise<Hash> {
    const wallet = getWalletClient();
    return wallet.sendTransaction({
        account,
        chain: celo,
        to: address,
        data,
        type: "legacy",
        feeCurrency: USDM_ADAPTER,
    });
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
