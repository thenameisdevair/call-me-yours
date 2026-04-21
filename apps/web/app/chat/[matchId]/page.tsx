"use client";

import { ArrowLeft, Loader2, Send } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    IdentifierKind,
    type DecodedMessage,
    type Dm,
} from "@xmtp/browser-sdk";
import { useMiniPay } from "@/hooks/useMiniPay";
import { useXMTP } from "@/hooks/useXMTP";
import { useChatSession } from "@/hooks/useChatSession";
import { getSupabase } from "@/lib/supabase";
import type { Match, Profile } from "@/lib/database.types";

interface ChatMessage {
    id: string;
    text: string;
    fromMe: boolean;
    sentAt: Date;
}

export default function ChatPage() {
    const router = useRouter();
    const params = useParams<{ matchId: string }>();
    const matchId = params.matchId;

    const { address, isLoading: walletLoading } = useMiniPay();
    const me = address?.toLowerCase() ?? null;
    const xmtp = useXMTP();

    const [match, setMatch] = useState<Match | null>(null);
    const [partner, setPartner] = useState<Profile | null>(null);
    const [loadingMatch, setLoadingMatch] = useState(true);
    const [matchError, setMatchError] = useState<string | null>(null);

    const [dm, setDm] = useState<Dm | null>(null);
    const [partnerOnXmtp, setPartnerOnXmtp] = useState<boolean | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loadingConvo, setLoadingConvo] = useState(false);
    const [convoError, setConvoError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [draft, setDraft] = useState("");

    const bottomRef = useRef<HTMLDivElement | null>(null);

    const { recordMessageSent } = useChatSession(matchId);

    // Match-gated access: verify the signed-in wallet is one of the two
    // users on the match. If not, kick them back to /matches.
    useEffect(() => {
        if (walletLoading || !me || !matchId) return;
        let cancelled = false;
        (async () => {
            setLoadingMatch(true);
            setMatchError(null);
            try {
                const supabase = getSupabase();
                const { data: m, error } = await supabase
                    .from("matches")
                    .select("*")
                    .eq("id", matchId)
                    .maybeSingle();
                if (error) throw error;
                if (!m) throw new Error("Match not found");

                const partnerAddr =
                    m.user_a.toLowerCase() === me ? m.user_b : m.user_a;
                if (
                    m.user_a.toLowerCase() !== me &&
                    m.user_b.toLowerCase() !== me
                ) {
                    throw new Error("Not your match");
                }

                const { data: p } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("wallet_address", partnerAddr.toLowerCase())
                    .maybeSingle();

                if (!cancelled) {
                    setMatch(m);
                    setPartner(p ?? null);
                }
            } catch (e) {
                if (!cancelled) {
                    setMatchError(
                        e instanceof Error ? e.message : "Could not load match"
                    );
                }
            } finally {
                if (!cancelled) setLoadingMatch(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [me, matchId, walletLoading]);

    // Initialize the DM with the match partner once the XMTP client and
    // match are both ready. Resolve the partner's inboxId from their
    // Ethereum address, then findOrCreate the DM.
    useEffect(() => {
        if (xmtp.status !== "ready" || !match || !me) return;
        const client = xmtp.client;
        const partnerAddr = (
            match.user_a.toLowerCase() === me ? match.user_b : match.user_a
        ).toLowerCase();

        let cancelled = false;
        let streamCleanup: (() => void) | null = null;

        (async () => {
            setLoadingConvo(true);
            setConvoError(null);
            setMessages([]);
            try {
                const identifier = {
                    identifier: partnerAddr,
                    identifierKind: IdentifierKind.Ethereum,
                };

                const canMessageMap = await client.canMessage([identifier]);
                const reachable = canMessageMap.get(partnerAddr) ?? false;
                if (!reachable) {
                    if (!cancelled) setPartnerOnXmtp(false);
                    return;
                }

                const partnerInboxId = await client.fetchInboxIdByIdentifier(
                    identifier
                );
                if (!partnerInboxId) {
                    if (!cancelled) setPartnerOnXmtp(false);
                    return;
                }
                if (!cancelled) setPartnerOnXmtp(true);

                const convos = client.conversations;
                const existing = await convos.getDmByInboxId(partnerInboxId);
                const conversation: Dm =
                    (existing as Dm | undefined) ??
                    (await convos.createDm(partnerInboxId));

                if (cancelled) return;
                setDm(conversation);

                const history = await conversation.messages();
                const myInboxId = client.inboxId;
                if (!cancelled) {
                    setMessages(
                        history
                            .map((m) => decode(m, myInboxId))
                            .filter((m): m is ChatMessage => m !== null)
                    );
                }

                const stream = await conversation.stream();
                streamCleanup = () => {
                    void stream.return();
                };
                (async () => {
                    for await (const incoming of stream) {
                        if (cancelled || !incoming) continue;
                        const decoded = decode(incoming, myInboxId);
                        if (!decoded) continue;
                        setMessages((prev) =>
                            prev.some((m) => m.id === decoded.id)
                                ? prev
                                : [...prev, decoded]
                        );
                    }
                })().catch(() => {
                    /* stream closed */
                });
            } catch (e) {
                if (!cancelled) {
                    setConvoError(
                        e instanceof Error ? e.message : "Could not load chat"
                    );
                }
            } finally {
                if (!cancelled) setLoadingConvo(false);
            }
        })();

        return () => {
            cancelled = true;
            streamCleanup?.();
        };
    }, [xmtp, match, me]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length]);

    const canSend = useMemo(
        () => Boolean(dm && draft.trim() && !sending),
        [dm, draft, sending]
    );

    const onSend = useCallback(async () => {
        if (!dm || !draft.trim()) return;
        const text = draft.trim();
        setSending(true);
        setConvoError(null);
        try {
            await dm.sendText(text);
            setDraft("");
            // Session metadata only — never content.
            await recordMessageSent();
        } catch (e) {
            setConvoError(e instanceof Error ? e.message : "Could not send");
        } finally {
            setSending(false);
        }
    }, [dm, draft, recordMessageSent]);

    const partnerName =
        partner?.display_name ??
        (match
            ? shorten(
                  (match.user_a.toLowerCase() === me
                      ? match.user_b
                      : match.user_a
                  ).toLowerCase()
              )
            : "");

    return (
        <main className="flex min-h-dvh flex-col bg-background">
            <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
                <button
                    type="button"
                    aria-label="Back"
                    onClick={() => router.push("/matches")}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground hover:border-primary hover:text-primary"
                >
                    <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                        {partner?.photos?.[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={partner.photos[0]}
                                alt={partnerName}
                                className="h-full w-full object-cover"
                                loading="lazy"
                            />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center font-serif text-lg text-muted-foreground">
                                {partnerName.slice(0, 1).toUpperCase()}
                            </div>
                        )}
                    </div>
                    <div className="min-w-0">
                        <div className="truncate font-serif text-xl leading-tight">
                            {partnerName || "Chat"}
                        </div>
                        {partner?.age && (
                            <div className="text-xs text-muted-foreground">
                                {partner.age}
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-24 pt-4">
                {loadingMatch || xmtp.status === "initializing" || loadingConvo ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <p className="text-xs">
                            {xmtp.status === "initializing"
                                ? "Opening encrypted inbox…"
                                : "Loading conversation…"}
                        </p>
                    </div>
                ) : matchError ? (
                    <ErrorState message={matchError} />
                ) : xmtp.status === "error" ? (
                    <ErrorState message={xmtp.error} />
                ) : partnerOnXmtp === false ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                        <div className="font-serif text-3xl">Almost there</div>
                        <p className="max-w-xs text-sm text-muted-foreground">
                            {partnerName} hasn&apos;t set up encrypted chat yet.
                            Check back shortly.
                        </p>
                    </div>
                ) : (
                    <>
                        <ul className="flex flex-1 flex-col gap-2">
                            {messages.length === 0 ? (
                                <li className="mt-10 text-center text-sm text-muted-foreground">
                                    Say something thoughtful.
                                </li>
                            ) : (
                                messages.map((m) => (
                                    <li
                                        key={m.id}
                                        className={
                                            m.fromMe
                                                ? "self-end max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground"
                                                : "self-start max-w-[80%] rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-2 text-sm"
                                        }
                                    >
                                        {m.text}
                                    </li>
                                ))
                            )}
                            <div ref={bottomRef} />
                        </ul>
                        {convoError && (
                            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                                {convoError}
                            </p>
                        )}
                    </>
                )}
            </div>

            {partnerOnXmtp && (
                <div className="sticky bottom-0 border-t border-border bg-background/95 p-3 backdrop-blur">
                    <form
                        className="mx-auto flex max-w-md items-center gap-2"
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (canSend) onSend();
                        }}
                    >
                        <input
                            type="text"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            placeholder="Write a message"
                            className="flex-1 rounded-full border border-border bg-card px-4 py-2 text-sm outline-none focus:border-primary"
                            disabled={!dm || sending}
                        />
                        <button
                            type="submit"
                            aria-label="Send"
                            disabled={!canSend}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
                        >
                            {sending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                        </button>
                    </form>
                </div>
            )}
        </main>
    );
}

function ErrorState({ message }: { message: string }) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <div className="font-serif text-2xl">Something went wrong</div>
            <p className="max-w-xs text-sm text-muted-foreground">{message}</p>
            <Link
                href="/matches"
                className="mt-2 rounded-full border border-border px-4 py-2 text-sm hover:border-primary hover:text-primary"
            >
                Back to matches
            </Link>
        </div>
    );
}

function decode(
    msg: DecodedMessage,
    myInboxId: string | undefined
): ChatMessage | null {
    // V1 scope: text only. Drop system / non-string content silently.
    if (typeof msg.content !== "string") return null;
    return {
        id: msg.id,
        text: msg.content,
        fromMe: Boolean(myInboxId && msg.senderInboxId === myInboxId),
        sentAt: msg.sentAt,
    };
}

function shorten(addr: string): string {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
