"use client";

import { useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useT } from '@/lib/i18n';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const t = useT();

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSuccess(false);

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });

            if (error) {
                const msg = error.message || '';
                if (msg.includes('rate limit') || msg.includes('Error sending recovery email') || msg.includes('over the email rate limit')) {
                    setError(t.auth_rate_limit);
                } else {
                    setError(msg);
                }
                return;
            }

            setSuccess(true);
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background-light flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans transition-colors">
            {/* Background blur */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none flex justify-center">
                <div className="w-[800px] h-[400px] bg-primary/5 blur-[120px] rounded-full translate-y-[-50%]" />
            </div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
                <div className="flex justify-center mb-8">
                    <div className="flex items-center gap-4">
                        <div className="relative flex-shrink-0 w-12 h-12 rounded-2xl bg-[#3E88B0] flex items-center justify-center overflow-hidden shadow-lg shadow-primary/20">
                            <Image src="/logo-manao.svg" alt="ManaoHQ Logo" fill className="object-cover scale-120" />
                        </div>
                        <div className="flex flex-col justify-center">
                            <span className="text-4xl font-bold tracking-tight text-text-main block leading-none w-full mb-1">
                                ManaoHQ
                            </span>
                            <span className="text-sm font-semibold text-text-muted uppercase tracking-wider text-[#8a6d3b]">
                                Command the Chaos
                            </span>
                        </div>
                    </div>
                </div>

                <div className="text-center">
                    <h2 className="text-3xl font-bold tracking-tight text-text-main">
                        {t.auth_forgot_title}
                    </h2>
                    <p className="mt-2 text-sm font-bold text-text-muted">
                        {t.auth_forgot_desc}
                    </p>
                </div>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-[440px] relative z-10">
                <div className="bg-surface-white py-8 px-4 shadow-xl shadow-black/5 sm:rounded-3xl sm:px-10 border border-border-subtle">
                    {success ? (
                        <div className="text-center space-y-4 py-4">
                            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
                                <span className="material-symbols-outlined text-emerald-500 text-[32px]">check_circle</span>
                            </div>
                            <h3 className="text-lg font-bold text-text-main">{t.auth_check_inbox}</h3>
                            <p className="text-sm text-text-muted">
                                {t.auth_reset_sent_desc} <span className="font-bold text-text-main">{email}</span>{t.auth_check_inbox_suffix}
                            </p>
                            <div className="pt-4">
                                <Link
                                    href="/login"
                                    className="flex w-full justify-center rounded-xl bg-background-light px-3 py-3 text-sm font-bold text-text-main hover:bg-gray-100 transition-colors border border-border-subtle"
                                >
                                    {t.auth_return_login}
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <form className="space-y-6" onSubmit={handleResetPassword}>
                            <div>
                                <label
                                    htmlFor="email"
                                    className="block text-sm font-bold text-text-main"
                                >
                                    {t.auth_email}
                                </label>
                                <div className="mt-2">
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        autoComplete="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="block w-full rounded-xl border border-border-subtle bg-background-light/50 py-3 px-4 text-text-main shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 sm:text-sm sm:leading-6 transition-all placeholder:text-gray-400 font-medium outline-none"
                                        placeholder="name@company.com"
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="rounded-xl bg-red-50 p-4 border border-red-200 flex items-start animate-in fade-in slide-in-from-top-2 duration-200">
                                    <span className="material-symbols-outlined text-red-500 mt-0.5 mr-3 flex-shrink-0 text-[20px]">error</span>
                                    <p className="text-sm text-red-600 font-bold leading-relaxed">
                                        {error}
                                    </p>
                                </div>
                            )}

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="flex w-full justify-center rounded-xl bg-primary px-3 py-3 text-sm font-bold text-white shadow-md shadow-primary/20 hover:bg-[#327396] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed items-center group"
                                >
                                    {isLoading ? (
                                        <>
                                            <svg
                                                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                            >
                                                <circle
                                                    className="opacity-25"
                                                    cx="12"
                                                    cy="12"
                                                    r="10"
                                                    stroke="currentColor"
                                                    strokeWidth="4"
                                                />
                                                <path
                                                    className="opacity-75"
                                                    fill="currentColor"
                                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                />
                                            </svg>
                                            <span>{t.auth_sending}</span>
                                        </>
                                    ) : (
                                        <span>{t.auth_send_link}</span>
                                    )}
                                </button>
                            </div>

                            <p className="mt-8 text-center text-sm font-bold text-text-muted">
                                {t.auth_remember_password}{" "}
                                <Link
                                    href="/login"
                                    className="text-primary hover:text-primary-hover transition-colors"
                                >
                                    {t.auth_back_to_login}
                                </Link>
                            </p>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
