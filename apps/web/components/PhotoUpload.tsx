"use client";

import imageCompression from "browser-image-compression";
import { Loader2, Plus, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";

export interface UploadedPhoto {
    url: string;
    path: string;
}

interface PhotoUploadProps {
    wallet: string;
    photos: UploadedPhoto[];
    onChange: (photos: UploadedPhoto[]) => void;
    max?: number;
}

const COMPRESSION_OPTIONS = {
    maxSizeMB: 0.2,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: "image/webp" as const,
    initialQuality: 0.82,
};

export default function PhotoUpload({ wallet, photos, onChange, max = 5 }: PhotoUploadProps) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<number | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const remaining = max - photos.length;

    const handleFiles = useCallback(
        async (files: FileList | null) => {
            if (!files || files.length === 0) return;
            setError(null);
            setBusy(true);
            const supabase = getSupabase();
            const next: UploadedPhoto[] = [...photos];
            try {
                const take = Array.from(files).slice(0, remaining);
                for (let i = 0; i < take.length; i++) {
                    const file = take[i];
                    setProgress(Math.round((i / take.length) * 100));
                    const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
                    const ext = "webp";
                    const path = `${wallet}/${crypto.randomUUID()}.${ext}`;
                    const { error: uploadErr } = await supabase.storage
                        .from("photos")
                        .upload(path, compressed, {
                            contentType: "image/webp",
                            upsert: false,
                            cacheControl: "3600",
                        });
                    if (uploadErr) throw uploadErr;
                    const { data } = supabase.storage.from("photos").getPublicUrl(path);
                    next.push({ url: data.publicUrl, path });
                }
                onChange(next);
                setProgress(100);
            } catch (e) {
                setError(e instanceof Error ? e.message : "Upload failed");
            } finally {
                setBusy(false);
                setTimeout(() => setProgress(null), 600);
                if (inputRef.current) inputRef.current.value = "";
            }
        },
        [photos, onChange, remaining, wallet]
    );

    async function removePhoto(idx: number) {
        const target = photos[idx];
        const next = photos.filter((_, i) => i !== idx);
        onChange(next);
        try {
            const supabase = getSupabase();
            await supabase.storage.from("photos").remove([target.path]);
        } catch {
            // Best-effort cleanup; the row already reflects removal in state.
        }
    }

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
                {photos.map((p, idx) => (
                    <div
                        key={p.path}
                        className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted"
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={p.url}
                            alt={`Photo ${idx + 1}`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                        />
                        <button
                            type="button"
                            onClick={() => removePhoto(idx)}
                            aria-label="Remove photo"
                            className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                ))}
                {remaining > 0 && (
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        disabled={busy}
                        className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border bg-background/60 text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
                    >
                        {busy ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <>
                                <Plus className="h-5 w-5" />
                                <span className="text-[11px] font-medium">Add photo</span>
                            </>
                        )}
                    </button>
                )}
            </div>

            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                onChange={(e) => handleFiles(e.target.files)}
            />

            {progress !== null && (
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}

            {error && (
                <p className="text-xs text-red-600" role="alert">
                    {error}
                </p>
            )}

            <p className="text-xs text-muted-foreground">
                {photos.length}/{max} photos · compressed to 200KB before upload
            </p>
        </div>
    );
}
