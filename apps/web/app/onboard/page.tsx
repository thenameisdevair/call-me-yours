"use client";

import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import PhotoUpload, { type UploadedPhoto } from "@/components/PhotoUpload";
import { useMiniPay } from "@/hooks/useMiniPay";
import { getSupabase } from "@/lib/supabase";
import type { Gender } from "@/lib/database.types";

type Step = 0 | 1 | 2;

interface FormState {
    displayName: string;
    age: string;
    gender: Gender | "";
    seeking: Gender | "";
    bio: string;
    photos: UploadedPhoto[];
}

const INITIAL: FormState = {
    displayName: "",
    age: "",
    gender: "",
    seeking: "",
    bio: "",
    photos: [],
};

const MIN_AGE = 18;
const MAX_AGE = 99;
const BIO_MAX = 280;

export default function OnboardPage() {
    const router = useRouter();
    const { address, isLoading: walletLoading } = useMiniPay();
    const [step, setStep] = useState<Step>(0);
    const [form, setForm] = useState<FormState>(INITIAL);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const ageNum = Number(form.age);
    const ageEntered = form.age.trim().length > 0;
    const ageUnder18 = ageEntered && Number.isFinite(ageNum) && ageNum < MIN_AGE;
    const ageInvalid =
        ageEntered &&
        (!Number.isFinite(ageNum) || ageNum < MIN_AGE || ageNum > MAX_AGE);

    const step1Valid = useMemo(
        () =>
            form.displayName.trim().length >= 2 &&
            ageEntered &&
            !ageInvalid &&
            form.gender !== "" &&
            form.seeking !== "",
        [form, ageEntered, ageInvalid]
    );
    const step2Valid = form.bio.trim().length > 0 && form.bio.length <= BIO_MAX;
    const step3Valid = form.photos.length >= 1;

    function update<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm((s) => ({ ...s, [key]: value }));
    }

    async function handleSubmit() {
        if (!address) {
            setSubmitError("Wallet not ready. Reopen in MiniPay.");
            return;
        }
        if (!step1Valid || !step2Valid || !step3Valid) return;
        setSubmitting(true);
        setSubmitError(null);
        try {
            const supabase = getSupabase();
            const wallet = address.toLowerCase();
            const { error } = await supabase.from("profiles").insert({
                wallet_address: wallet,
                display_name: form.displayName.trim(),
                age: ageNum,
                gender: form.gender as Gender,
                seeking: form.seeking as Gender,
                bio: form.bio.trim(),
                photos: form.photos.map((p) => p.url),
                is_active: true,
            });
            if (error) throw error;
            router.replace("/discover");
        } catch (e) {
            setSubmitError(e instanceof Error ? e.message : "Could not save profile");
            setSubmitting(false);
        }
    }

    if (walletLoading) {
        return (
            <main className="flex min-h-dvh items-center justify-center p-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </main>
        );
    }

    return (
        <main className="min-h-dvh bg-background">
            <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-8 pt-6">
                <Progress step={step} />

                <div className="mt-6 flex-1">
                    {step === 0 && (
                        <StepOne
                            form={form}
                            ageUnder18={ageUnder18}
                            ageInvalid={ageInvalid}
                            update={update}
                        />
                    )}
                    {step === 1 && <StepTwo form={form} update={update} />}
                    {step === 2 && (
                        <StepThree
                            wallet={address?.toLowerCase() ?? ""}
                            form={form}
                            update={update}
                        />
                    )}
                </div>

                {submitError && (
                    <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                        {submitError}
                    </p>
                )}

                <Nav
                    step={step}
                    canGoForward={
                        step === 0 ? step1Valid : step === 1 ? step2Valid : step3Valid
                    }
                    submitting={submitting}
                    onBack={() => setStep((s) => (s > 0 ? ((s - 1) as Step) : s))}
                    onNext={() => {
                        if (step < 2) setStep((s) => (s + 1) as Step);
                        else handleSubmit();
                    }}
                />
            </div>
        </main>
    );
}

function Progress({ step }: { step: Step }) {
    return (
        <div className="flex items-center gap-2">
            {[0, 1, 2].map((i) => (
                <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                        i <= step ? "bg-primary" : "bg-muted"
                    }`}
                />
            ))}
        </div>
    );
}

function StepOne({
    form,
    ageUnder18,
    ageInvalid,
    update,
}: {
    form: FormState;
    ageUnder18: boolean;
    ageInvalid: boolean;
    update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
    return (
        <section className="space-y-6">
            <header className="space-y-2">
                <h1 className="font-serif text-4xl leading-tight text-foreground">
                    Tell us who you are
                </h1>
                <p className="text-sm text-muted-foreground">
                    The basics first. We keep this simple on purpose.
                </p>
            </header>

            <Field label="Your name">
                <input
                    value={form.displayName}
                    onChange={(e) => update("displayName", e.target.value)}
                    maxLength={40}
                    placeholder="How should we call you?"
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base outline-none transition focus:border-primary"
                />
            </Field>

            <Field label="Your age" hint="You must be 18 or older.">
                <input
                    value={form.age}
                    onChange={(e) =>
                        update("age", e.target.value.replace(/[^\d]/g, "").slice(0, 2))
                    }
                    inputMode="numeric"
                    placeholder="25"
                    className={`w-full rounded-xl border bg-background px-4 py-3 text-base outline-none transition focus:border-primary ${
                        ageInvalid ? "border-red-500" : "border-border"
                    }`}
                />
                {ageUnder18 && (
                    <p className="mt-2 text-xs text-red-600">
                        You must be at least 18 to use Call Me Yours.
                    </p>
                )}
                {ageInvalid && !ageUnder18 && (
                    <p className="mt-2 text-xs text-red-600">Please enter a valid age.</p>
                )}
            </Field>

            <Field label="I am">
                <Segmented
                    value={form.gender}
                    options={[
                        { value: "male", label: "Man" },
                        { value: "female", label: "Woman" },
                    ]}
                    onChange={(v) => update("gender", v as Gender)}
                />
            </Field>

            <Field label="Looking for">
                <Segmented
                    value={form.seeking}
                    options={[
                        { value: "male", label: "Men" },
                        { value: "female", label: "Women" },
                    ]}
                    onChange={(v) => update("seeking", v as Gender)}
                />
            </Field>
        </section>
    );
}

function StepTwo({
    form,
    update,
}: {
    form: FormState;
    update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
    const remaining = BIO_MAX - form.bio.length;
    return (
        <section className="space-y-6">
            <header className="space-y-2">
                <h1 className="font-serif text-4xl leading-tight text-foreground">
                    A few words about you
                </h1>
                <p className="text-sm text-muted-foreground">
                    What would you want a stranger to know before they say hello?
                </p>
            </header>

            <Field label="Your bio">
                <textarea
                    value={form.bio}
                    onChange={(e) => update("bio", e.target.value.slice(0, BIO_MAX))}
                    rows={6}
                    placeholder="I love late-night conversations, slow cooking, and getting lost in new cities…"
                    className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-base outline-none transition focus:border-primary"
                />
                <p className="mt-2 text-right text-xs text-muted-foreground">
                    {remaining} characters left
                </p>
            </Field>
        </section>
    );
}

function StepThree({
    wallet,
    form,
    update,
}: {
    wallet: string;
    form: FormState;
    update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
    return (
        <section className="space-y-6">
            <header className="space-y-2">
                <h1 className="font-serif text-4xl leading-tight text-foreground">
                    Show yourself
                </h1>
                <p className="text-sm text-muted-foreground">
                    Add at least one photo. Real photos, real faces — that&apos;s the point.
                </p>
            </header>

            {wallet ? (
                <PhotoUpload
                    wallet={wallet}
                    photos={form.photos}
                    onChange={(p) => update("photos", p)}
                />
            ) : (
                <p className="text-sm text-muted-foreground">Waiting for MiniPay…</p>
            )}
        </section>
    );
}

function Field({
    label,
    hint,
    children,
}: {
    label: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
            </span>
            {children}
            {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
        </label>
    );
}

function Segmented({
    value,
    options,
    onChange,
}: {
    value: string;
    options: { value: string; label: string }[];
    onChange: (v: string) => void;
}) {
    return (
        <div className="grid grid-cols-2 gap-2">
            {options.map((opt) => {
                const active = value === opt.value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange(opt.value)}
                        className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                            active
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background text-foreground hover:border-primary/50"
                        }`}
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}

function Nav({
    step,
    canGoForward,
    submitting,
    onBack,
    onNext,
}: {
    step: Step;
    canGoForward: boolean;
    submitting: boolean;
    onBack: () => void;
    onNext: () => void;
}) {
    const isLast = step === 2;
    return (
        <div className="sticky bottom-0 mt-6 flex items-center gap-3 bg-background pt-4">
            {step > 0 && (
                <button
                    type="button"
                    onClick={onBack}
                    disabled={submitting}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border text-foreground transition hover:border-primary disabled:opacity-50"
                    aria-label="Back"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
            )}
            <button
                type="button"
                onClick={onNext}
                disabled={!canGoForward || submitting}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
            >
                {submitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                ) : isLast ? (
                    <>
                        Create profile <Check className="h-5 w-5" />
                    </>
                ) : (
                    <>
                        Continue <ArrowRight className="h-5 w-5" />
                    </>
                )}
            </button>
        </div>
    );
}
