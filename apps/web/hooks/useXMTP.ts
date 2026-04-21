"use client";

import { useEffect, useRef, useState } from "react";
import {
    Client,
    IdentifierKind,
    type NetworkOptions,
    type Signer,
    type StorageOptions,
    type XmtpEnv,
} from "@xmtp/browser-sdk";
import type { Address } from "viem";
import { useMiniPay } from "./useMiniPay";

// V3 uses an inboxId as the primary identifier. The client is initialized
// once per wallet address via an EOA signer that proxies `personal_sign` to
// MiniPay. A per-wallet 32-byte dbEncryptionKey is persisted in localStorage
// so the OPFS database can be opened on subsequent loads without prompting
// for a new signature.

const XMTP_ENV = (process.env.NEXT_PUBLIC_XMTP_ENV as XmtpEnv | undefined) ?? "dev";

type State =
    | { status: "idle"; client: null; error: null }
    | { status: "initializing"; client: null; error: null }
    | { status: "ready"; client: Client; error: null }
    | { status: "error"; client: null; error: string };

const INIT_STATE: State = { status: "idle", client: null, error: null };

// Module-level cache so we don't re-initialize across remounts in the same
// tab. Keyed by address because MiniPay exposes exactly one wallet at a time.
let cachedClient: Client | null = null;
let cachedAddress: string | null = null;

export function useXMTP() {
    const { isMiniPay, address, isLoading } = useMiniPay();
    const [state, setState] = useState<State>(INIT_STATE);
    const initializing = useRef(false);

    useEffect(() => {
        if (isLoading || !isMiniPay || !address) return;
        if (cachedClient && cachedAddress === address) {
            setState({ status: "ready", client: cachedClient, error: null });
            return;
        }
        if (initializing.current) return;
        initializing.current = true;

        let cancelled = false;
        setState({ status: "initializing", client: null, error: null });

        initClient(address)
            .then((client) => {
                cachedClient = client;
                cachedAddress = address;
                if (!cancelled) {
                    setState({ status: "ready", client, error: null });
                }
            })
            .catch((err) => {
                const msg = err instanceof Error ? err.message : "XMTP init failed";
                if (!cancelled) {
                    setState({ status: "error", client: null, error: msg });
                }
            })
            .finally(() => {
                initializing.current = false;
            });

        return () => {
            cancelled = true;
        };
    }, [isLoading, isMiniPay, address]);

    return state;
}

async function initClient(address: Address): Promise<Client> {
    const signer = buildEOASigner(address);
    const dbEncryptionKey = getOrCreateEncryptionKey(address);
    // Build options as the exact intersection of NetworkOptions &
    // StorageOptions. Using the full `ClientOptions` union would widen the
    // codec generic and turn the returned Client's content type into
    // `unknown`, breaking downstream consumers.
    const options: NetworkOptions & StorageOptions = {
        env: XMTP_ENV,
        dbEncryptionKey,
    };
    return Client.create(signer, options);
}

function buildEOASigner(address: Address): Signer {
    return {
        type: "EOA",
        getIdentifier: () => ({
            identifier: address.toLowerCase(),
            identifierKind: IdentifierKind.Ethereum,
        }),
        signMessage: async (message: string): Promise<Uint8Array> => {
            if (!window.ethereum) throw new Error("No injected wallet");
            const sig = (await window.ethereum.request({
                method: "personal_sign",
                params: [message, address],
            })) as string;
            return hexToBytes(sig);
        },
    };
}

function hexToBytes(hex: string): Uint8Array {
    const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) {
        out[i] = parseInt(clean.substr(i * 2, 2), 16);
    }
    return out;
}

function getOrCreateEncryptionKey(address: Address): Uint8Array {
    const storageKey = `cmy:xmtp:dbkey:${address.toLowerCase()}`;
    if (typeof window === "undefined") return new Uint8Array(32);
    const existing = window.localStorage.getItem(storageKey);
    if (existing) {
        try {
            const parsed = JSON.parse(existing) as number[];
            if (Array.isArray(parsed) && parsed.length === 32) {
                return new Uint8Array(parsed);
            }
        } catch {
            /* regenerate */
        }
    }
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    window.localStorage.setItem(storageKey, JSON.stringify(Array.from(bytes)));
    return bytes;
}
