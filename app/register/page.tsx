"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useT } from '@/lib/i18n';

export default function RegisterPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const router = useRouter();
    const t = useT();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) {
                setError(error.message);
                return;
            }

            // Show success message then redirect to login
            setSuccess(true);
            setTimeout(() => {
                router.push("/login");
            }, 3000);
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                },
            });

            if (error) {
                setError(error.message);
            }
        } catch (err: any) {
            setError(err.message || "Failed to initialize Google login");
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
                        {t.auth_register_title}
                    </h2>
                    <p className="mt-2 text-sm font-bold text-text-muted">
                        {t.auth_register_subtitle}
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
                            <h3 className="text-lg font-bold text-text-main">{t.auth_account_created}</h3>
                            <p className="text-sm text-text-muted">
                                {t.auth_check_email}
                            </p>
                            <div className="flex justify-center">
                                <svg className="animate-spin h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                            </div>
                        </div>
                    ) : (
                        <>
                            <form className="space-y-6" onSubmit={handleRegister}>
                                <div>
                                    <label
                                        htmlFor="register-email"
                                        className="block text-sm font-bold text-text-main"
                                    >
                                        {t.auth_email}
                                    </label>
                                    <div className="mt-2">
                                        <input
                                            id="register-email"
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

                                <div>
                                    <label
                                        htmlFor="register-password"
                                        className="block text-sm font-bold text-text-main"
                                    >
                                        {t.auth_password}
                                    </label>
                                    <div className="mt-2">
                                        <input
                                            id="register-password"
                                            name="password"
                                            type="password"
                                            autoComplete="new-password"
                                            required
                                            minLength={6}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="block w-full rounded-xl border border-border-subtle bg-background-light/50 py-3 px-4 text-text-main shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 sm:text-sm sm:leading-6 transition-all placeholder:text-gray-400 font-medium outline-none"
                                            placeholder={t.auth_password_min}
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

                                <div className="pt-2 flex flex-col gap-4">
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
                                                <span>{t.auth_signing_up}</span>
                                            </>
                                        ) : (
                                            <span>{t.auth_register}</span>
                                        )}
                                    </button>

                                    <div className="relative">
                                        <div className="absolute inset-0 flex items-center">
                                            <div className="w-full border-t border-border-subtle"></div>
                                        </div>
                                        <div className="relative flex justify-center text-sm">
                                            <span className="bg-surface-white px-2 text-text-muted">{t.auth_or}</span>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleGoogleLogin}
                                        className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-3 py-3 text-sm font-bold text-text-main shadow-sm border border-border-subtle hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-subtle transition-all"
                                    >
                                        <svg className="h-5 w-5" viewBox="0 0 24 24">
                                            <path
                                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                                fill="#4285F4"
                                            />
                                            <path
                                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                                fill="#34A853"
                                            />
                                            <path
                                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                                fill="#FBBC05"
                                            />
                                            <path
                                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                                fill="#EA4335"
                                            />
                                        </svg>
                                        <span>{t.auth_sign_up_google}</span>
                                    </button>
                                </div>
                            </form>

                            <p className="mt-8 text-center text-sm font-bold text-text-muted">
                                {t.auth_has_account}{" "}
                                <Link
                                    href="/login"
                                    className="text-primary hover:text-primary-hover transition-colors"
                                >
                                    {t.auth_back_login}
                                </Link>
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
