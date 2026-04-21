"use client";

import { useMiniPay } from "@/hooks/useMiniPay";

// MiniPay-only gate. If the app is opened outside MiniPay, we show a
// full-screen explanation instead of routing anywhere — there is no
// Connect button in CMY, ever.
export default function MiniPayGate({ children }: { children: React.ReactNode }) {
    const { isMiniPay, isLoading, error } = useMiniPay();

    if (isLoading) {
        return (
            <div className="flex min-h-dvh items-center justify-center p-6">
                <p className="text-muted-foreground text-sm">Connecting to MiniPay…</p>
            </div>
        );
    }

    if (!isMiniPay) {
        return (
            <div className="flex min-h-dvh items-center justify-center p-6">
                <div className="max-w-sm text-center space-y-3">
                    <h1 className="font-serif text-3xl">Call Me Yours</h1>
                    <p className="text-muted-foreground">
                        Please open Call Me Yours inside MiniPay to continue.
                    </p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex min-h-dvh items-center justify-center p-6">
                <div className="max-w-sm text-center space-y-3">
                    <h1 className="font-serif text-2xl">Something went wrong</h1>
                    <p className="text-muted-foreground text-sm">{error}</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
