import {
    createPublicClient,
    createWalletClient,
    custom,
    http,
    type Address,
    type Hash,
    type WalletClient,
} from "viem";
import { celo } from "viem/chains";

// CMY runs inside MiniPay on Celo mainnet. Every transaction we originate
// must be a legacy tx with `feeCurrency: USDM_ADAPTER` so users pay gas in
// USDm — they never need CELO. Viem's Celo chain extension surfaces the
// feeCurrency field.

export const USDM_ADDRESS =
    (process.env.NEXT_PUBLIC_USDM_ADDRESS as Address) ??
    "0x765DE816845861e75A25fCA122bb6898B8B1282a";

export const USDM_ADAPTER =
    (process.env.NEXT_PUBLIC_USDM_ADAPTER as Address) ??
    "0x765DE816845861e75A25fCA122bb6898B8B1282a";

const RPC = process.env.NEXT_PUBLIC_CELO_RPC ?? "https://forno.celo.org";

export const publicClient = createPublicClient({
    chain: celo,
    transport: http(RPC),
});

export function getWalletClient(): WalletClient {
    if (typeof window === "undefined" || !window.ethereum) {
        throw new Error("No injected wallet found");
    }
    return createWalletClient({
        chain: celo,
        transport: custom(window.ethereum),
    });
}

// ERC20 balanceOf — read USDm balance for a wallet.
const ERC20_BALANCE_OF_ABI = [
    {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
    },
] as const;

export async function checkUSDmBalance(address: Address): Promise<bigint> {
    return publicClient.readContract({
        address: USDM_ADDRESS,
        abi: ERC20_BALANCE_OF_ABI,
        functionName: "balanceOf",
        args: [address],
    }) as Promise<bigint>;
}

export async function checkTransactionSuccess(hash: Hash): Promise<boolean> {
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return receipt.status === "success";
}

declare global {
    interface Window {
        ethereum?: {
            isMiniPay?: boolean;
            request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
        };
    }
}
