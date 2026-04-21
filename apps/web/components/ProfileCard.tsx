"use client";

import Link from "next/link";
import type { Profile } from "@/lib/database.types";

interface ProfileCardProps {
    profile: Profile;
    priority?: boolean;
}

// Feed card. Photo-first, with a soft gradient so the name and age read on
// any background. Tap anywhere → full profile.
export default function ProfileCard({ profile, priority = false }: ProfileCardProps) {
    const photo = profile.photos[0];
    const href = `/profile/${profile.wallet_address}`;

    return (
        <Link
            href={href}
            prefetch={false}
            className="group relative block aspect-[3/4] w-full overflow-hidden rounded-2xl bg-muted shadow-sm ring-1 ring-border/60 transition-transform active:scale-[0.99]"
        >
            {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={photo}
                    alt={profile.display_name}
                    loading={priority ? "eager" : "lazy"}
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
            ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-background">
                    <span className="font-serif text-4xl text-muted-foreground">
                        {profile.display_name.slice(0, 1)}
                    </span>
                </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-4">
                <div className="flex items-baseline gap-2 text-white">
                    <h3 className="font-serif text-2xl leading-tight">
                        {profile.display_name}
                    </h3>
                    <span className="text-base opacity-90">{profile.age}</span>
                </div>
            </div>
        </Link>
    );
}
