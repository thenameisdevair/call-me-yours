"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";

interface UseMiniPay {
    isMiniPay: boolean;
    address: Address | null;
    isLoading: boolean;
    error: string | null;
}

// Detects MiniPay via window.ethereum.isMiniPay. Inside MiniPay, wallet
// access is implicit — eth_requestAccounts resolves without a prompt. If the
// app is opened outside MiniPay we do not attempt to connect at all.
export function useMiniPay(): UseMiniPay {
    const [state, setState] = useState<UseMiniPay>({
        isMiniPay: false,
        address: null,
        isLoading: true,
        error: null,
    });

    useEffect(() => {
        let cancelled = false;
        async function init() {
            if (typeof window === "undefined" || !window.ethereum) {
                if (!cancelled) {
                    setState({ isMiniPay: false, address: null, isLoading: false, error: null });
                }
                return;
            }
            const isMiniPay = Boolean(window.ethereum.isMiniPay);
            if (!isMiniPay) {
                if (!cancelled) {
                    setState({ isMiniPay: false, address: null, isLoading: false, error: null });
                }
                return;
            }
            try {
                const accounts = (await window.ethereum.request({
                    method: "eth_requestAccounts",
                })) as string[];
                const addr = (accounts[0] ?? "").toLowerCase() as Address;
                if (!cancelled) {
                    setState({
                        isMiniPay: true,
                        address: addr || null,
                        isLoading: false,
                        error: addr ? null : "No accounts returned by MiniPay",
                    });
                }
            } catch (err) {
                if (!cancelled) {
                    setState({
                        isMiniPay: true,
                        address: null,
                        isLoading: false,
                        error: err instanceof Error ? err.message : "Wallet request failed",
                    });
                }
            }
        }
        init();
        return () => {
            cancelled = true;
        };
    }, []);

    return state;
}
