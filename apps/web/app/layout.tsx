import type { Metadata, Viewport } from "next";
import { DM_Serif_Display, Plus_Jakarta_Sans } from "next/font/google";
import MiniPayGate from "@/components/MiniPayGate";
import "./globals.css";

const dmSerif = DM_Serif_Display({
    subsets: ["latin"],
    weight: ["400"],
    variable: "--font-dm-serif",
    display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
    subsets: ["latin"],
    variable: "--font-jakarta",
    display: "swap",
});

export const metadata: Metadata = {
    title: "Call Me Yours",
    description: "Dating on MiniPay — real people, real connections.",
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: "#fbf7f0",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className={`${dmSerif.variable} ${jakarta.variable}`}>
            <body className="font-sans min-h-dvh">
                <MiniPayGate>{children}</MiniPayGate>
            </body>
        </html>
    );
}
