'use client';

import { useEffect, useState, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { supabase } from '@/lib/supabase';
import MainCanvas from '@/components/MainCanvas';
import Image from 'next/image';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useT } from '@/lib/i18n';

interface PendingInvite {
    id: string;
    workspace_id: string;
    title: string;
    message: string;
    created_at: string;
}

export default function DashboardPage() {
    const { workspaces, fetchWorkspaces, createWorkspace, activeView } = useStore();
    const t = useT();
    const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
    const [loadingInvites, setLoadingInvites] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [creatingWorkspace, setCreatingWorkspace] = useState(false);
    const [showNameInput, setShowNameInput] = useState(false);
    const [workspaceName, setWorkspaceName] = useState('');

    // Fetch pending invites
    const fetchPendingInvites = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('in_app_notifications')
                .select('id, workspace_id, title, message, created_at')
                .eq('recipient_id', user.id)
                .eq('type', 'invite')
                .eq('is_read', false)
                .order('created_at', { ascending: false });

            if (!error && data) setPendingInvites(data);
        } catch (err) {
            console.warn('Error fetching invites:', err);
        } finally {
            setLoadingInvites(false);
        }
    }, []);

    useEffect(() => {
        fetchPendingInvites();
    }, [fetchPendingInvites]);

    // Accept invite
    const handleAccept = async (invite: PendingInvite) => {
        setProcessingId(invite.id);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error: insertErr } = await supabase
                .from('workspace_members')
                .insert([{
                    workspace_id: invite.workspace_id,
                    user_id: user.id,
                    user_name: user.email,
                    role: 'member',
                }]);
            if (insertErr) throw insertErr;

            await supabase
                .from('in_app_notifications')
                .update({ is_read: true })
                .eq('id', invite.id);

            setPendingInvites(prev => prev.filter(i => i.id !== invite.id));
            toast.success(t.welcome_accept + '! 🎉');
            await fetchWorkspaces();
        } catch (err: any) {
            console.error('Error accepting invite:', err);
            toast.error(err?.message || 'Failed to accept invite');
        } finally {
            setProcessingId(null);
        }
    };

    // Decline invite
    const handleDecline = async (invite: PendingInvite) => {
        setProcessingId(invite.id);
        try {
            await supabase
                .from('in_app_notifications')
                .delete()
                .eq('id', invite.id);

            setPendingInvites(prev => prev.filter(i => i.id !== invite.id));
            toast(t.welcome_decline);
        } catch (err: any) {
            console.error('Error declining invite:', err);
            toast.error('Failed to decline invite');
        } finally {
            setProcessingId(null);
        }
    };

    // Create first workspace
    const handleCreateWorkspace = async () => {
        if (!workspaceName.trim()) {
            toast.error('Please enter a workspace name');
            return;
        }
        setCreatingWorkspace(true);
        try {
            await createWorkspace(workspaceName.trim());
            toast.success('Workspace created! 🚀');
        } catch (err: any) {
            toast.error(err?.message || 'Failed to create workspace');
        } finally {
            setCreatingWorkspace(false);
        }
    };

    // ─── If user HAS workspaces OR is on a non-dashboard view → render MainCanvas ──
    if (workspaces.length > 0 || activeView !== 'dashboard') {
        return <MainCanvas />;
    }

    // ─── Loading state ─────────────────────────────────────────────────
    if (loadingInvites) {
        return (
            <div className="flex items-center justify-center h-full">
                <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
            </div>
        );
    }

    // ─── 0 workspaces + HAS pending invites ────────────────────────────
    if (pendingInvites.length > 0) {
        return (
            <div className="flex items-center justify-center h-full p-8 overflow-y-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className="w-full max-w-lg"
                >
                    {/* Logo + Tagline */}
                    <div className="flex flex-col items-center mb-12">
                        <div className="w-16 h-16 rounded-2xl bg-[#3E88B0] overflow-hidden relative shadow-lg mb-5">
                            <Image src="/logo-manao.svg" alt="ManaoHQ" fill className="object-cover scale-125" />
                        </div>
                        <h1 className="text-3xl font-black text-text-main dark:text-white tracking-tight">
                            {t.welcome_pending}
                        </h1>
                        <p className="text-text-muted text-sm mt-2">
                            {t.welcome_pending_desc}
                        </p>
                    </div>

                    {/* Invite Cards */}
                    <div className="space-y-4">
                        <AnimatePresence>
                            {pendingInvites.map((invite, i) => (
                                <motion.div
                                    key={invite.id}
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -40, height: 0, marginBottom: 0 }}
                                    transition={{ delay: i * 0.08, duration: 0.35, ease: 'easeOut' }}
                                    className="bg-surface-white dark:bg-gray-900 rounded-2xl border border-border-subtle p-6 shadow-sm hover:shadow-md transition-shadow"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                                            <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[20px]">
                                                group_add
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-text-main dark:text-gray-100 text-sm">
                                                {invite.title}
                                            </p>
                                            <p className="text-text-muted text-xs mt-1 line-clamp-2">
                                                {invite.message}
                                            </p>
                                            <div className="flex items-center gap-3 mt-4">
                                                <button
                                                    onClick={() => handleAccept(invite)}
                                                    disabled={processingId === invite.id}
                                                    className="flex items-center gap-1.5 px-5 py-2 bg-[#4F86C6] hover:bg-[#3d6fa8] text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 shadow-sm hover:shadow-md"
                                                >
                                                    {processingId === invite.id ? (
                                                        <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                                                    ) : (
                                                        <span className="material-symbols-outlined text-[14px]">check</span>
                                                    )}
                                                    {t.welcome_accept}
                                                </button>
                                                <button
                                                    onClick={() => handleDecline(invite)}
                                                    disabled={processingId === invite.id}
                                                    className="flex items-center gap-1.5 px-5 py-2 border border-border-subtle dark:border-gray-600 text-text-muted hover:text-red-500 hover:border-red-300 dark:hover:border-red-500/30 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                                                >
                                                    <span className="material-symbols-outlined text-[14px]">close</span>
                                                    {t.welcome_decline}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </div>
        );
    }

    // ─── 0 workspaces + NO invites → Welcome Screen ─────────────────────
    return (
        <div className="flex items-center justify-center h-full p-8">
            <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="flex flex-col items-center text-center max-w-md"
            >
                {/* Logo */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                    className="w-20 h-20 rounded-2xl bg-[#3E88B0] overflow-hidden relative shadow-xl mb-6"
                >
                    <Image src="/logo-manao.svg" alt="ManaoHQ" fill className="object-cover scale-125" />
                </motion.div>

                {/* Heading */}
                <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.4 }}
                    className="text-4xl font-black text-text-main dark:text-white tracking-tight"
                >
                    {t.welcome_title}
                </motion.h1>

                {/* Tagline */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.45, duration: 0.4 }}
                    className="text-text-muted text-sm mt-3 font-semibold uppercase tracking-widest"
                >
                    {t.welcome_subtitle}
                </motion.p>

                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.55, duration: 0.4 }}
                    className="text-text-muted text-base mt-6 leading-relaxed max-w-sm"
                >
                    {t.welcome_desc}
                </motion.p>

                {/* Create Workspace */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.65, duration: 0.4 }}
                    className="mt-10 w-full max-w-xs"
                >
                    {!showNameInput ? (
                        <button
                            onClick={() => setShowNameInput(true)}
                            className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-[#4F86C6] hover:bg-[#3d6fa8] text-white font-bold rounded-2xl transition-all shadow-lg hover:shadow-xl hover:shadow-[#4F86C6]/20 text-sm"
                        >
                            <span className="material-symbols-outlined text-[20px]">add</span>
                            {t.welcome_create}
                        </button>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="flex flex-col gap-3"
                        >
                            <input
                                type="text"
                                value={workspaceName}
                                onChange={(e) => setWorkspaceName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateWorkspace()}
                                placeholder={t.welcome_input_placeholder}
                                autoFocus
                                className="w-full px-5 py-3.5 bg-surface-white dark:bg-gray-800 border border-border-subtle rounded-xl text-sm font-medium text-text-main dark:text-gray-100 placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-[#4F86C6]/30 focus:border-[#4F86C6] transition-all"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCreateWorkspace}
                                    disabled={creatingWorkspace}
                                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[#4F86C6] hover:bg-[#3d6fa8] text-white font-bold rounded-xl transition-all disabled:opacity-50 text-sm"
                                >
                                    {creatingWorkspace ? (
                                        <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                                    ) : (
                                        <span className="material-symbols-outlined text-[16px]">rocket_launch</span>
                                    )}
                                    {t.welcome_create_btn}
                                </button>
                                <button
                                    onClick={() => { setShowNameInput(false); setWorkspaceName(''); }}
                                    className="px-4 py-3 border border-border-subtle dark:border-gray-600 text-text-muted rounded-xl hover:bg-[#f5f7fa] dark:hover:bg-gray-800 transition-colors text-sm font-semibold"
                                >
                                    {t.welcome_cancel}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </motion.div>
            </motion.div>
        </div>
    );
}
