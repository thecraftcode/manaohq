'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/useStore';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { useT } from '@/lib/i18n';

interface PendingInvite {
    id: string;
    workspace_id?: string;
    title: string;
    message: string;
    created_at: string;
}

export default function InviteAcceptModal() {
    const [invite, setInvite] = useState<PendingInvite | null>(null);
    const [processing, setProcessing] = useState(false);
    const { fetchWorkspaces, setActiveView } = useStore();
    const router = useRouter();
    const t = useT();

    // Listen for custom event to show invite modal
    useEffect(() => {
        const handleShowInvite = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                // Fetch the latest unread invite
                const { data, error } = await supabase
                    .from('in_app_notifications')
                    .select('id, workspace_id, title, message, created_at')
                    .eq('recipient_id', user.id)
                    .eq('type', 'invite')
                    .eq('is_read', false)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (!error && data) {
                    setInvite(data);
                }
            } catch (err) {
                console.warn('Error fetching invite:', err);
            }
        };

        window.addEventListener('manao-open-notifications', handleShowInvite);
        return () => window.removeEventListener('manao-open-notifications', handleShowInvite);
    }, []);

    // Listen for realtime updates so the modal auto-closes if accepted/declined elsewhere
    useEffect(() => {
        if (!invite) return;

        const channel = supabase
            .channel(`invite-modal-${invite.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'in_app_notifications',
                    filter: `id=eq.${invite.id}`,
                },
                (payload) => {
                    const newNotif = payload.new as any;
                    if (newNotif.is_read) {
                        setInvite(null);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'in_app_notifications',
                },
                (payload) => {
                    if (payload.old?.id === invite.id) {
                        setInvite(null);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [invite?.id]);

    const handleAccept = async () => {
        if (!invite) return;
        setProcessing(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const res = await fetch('/api/accept-invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    notificationId: invite.id,
                    workspaceId: invite.workspace_id,
                    userId: user.id,
                    userEmail: user.email,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to accept invite');
            }

            toast.success('Berhasil bergabung! 🎉');
            await fetchWorkspaces();

            // Auto-switch to the newly joined workspace
            if (invite.workspace_id) {
                useStore.getState().setActiveWorkspace(invite.workspace_id);
                await useStore.getState().fetchPosts();
                setActiveView('content');
                router.push(`/?tab=content&workspace=${invite.workspace_id}`);
            }

            setInvite(null);
        } catch (err: any) {
            console.error('Error accepting invite:', err);
            toast.error(err?.message || 'Gagal menerima undangan');
        } finally {
            setProcessing(false);
        }
    };

    const handleDecline = async () => {
        if (!invite) return;
        setProcessing(true);
        try {
            await supabase
                .from('in_app_notifications')
                .delete()
                .eq('id', invite.id);

            toast('Undangan ditolak');
            setInvite(null);
        } catch (err: any) {
            console.error('Error declining invite:', err);
            toast.error('Gagal menolak undangan');
        } finally {
            setProcessing(false);
        }
    };

    if (!invite) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[200] bg-gray-900/50 backdrop-blur-sm"
                onClick={() => setInvite(null)}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-[201] flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-surface-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-border-subtle dark:border-gray-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="px-8 pt-8 pb-4 text-center">
                        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mb-4">
                            <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[32px]">
                                group_add
                            </span>
                        </div>
                        <h2 className="text-xl font-black text-text-main dark:text-white">
                            Undangan Workspace
                        </h2>
                        <p className="text-sm text-text-muted mt-1">
                            Kamu diundang untuk bergabung!
                        </p>
                    </div>

                    {/* Invite Card */}
                    <div className="px-8 py-4">
                        <div className="bg-background-light dark:bg-gray-800 rounded-2xl p-5 border border-border-subtle/50 dark:border-gray-700">
                            <p className="font-bold text-text-main dark:text-gray-100 text-base">
                                {invite.title}
                            </p>
                            <p className="text-sm text-text-muted mt-2 leading-relaxed">
                                {invite.message}
                            </p>
                            <p className="text-xs text-text-muted/60 dark:text-gray-600 mt-3">
                                {formatDistanceToNow(new Date(invite.created_at), { addSuffix: true })}
                            </p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="px-8 pb-8 pt-2 flex items-center gap-3">
                        <button
                            onClick={handleDecline}
                            disabled={processing}
                            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 border border-border-subtle dark:border-gray-600 text-text-muted hover:text-red-500 hover:border-red-300 dark:hover:border-red-500/30 text-sm font-bold rounded-xl transition-all disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined text-[18px]">close</span>
                            {t.notif_decline}
                        </button>
                        <button
                            onClick={handleAccept}
                            disabled={processing}
                            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 shadow-lg hover:shadow-xl"
                        >
                            {processing ? (
                                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                            ) : (
                                <span className="material-symbols-outlined text-[18px]">check</span>
                            )}
                            {t.notif_accept}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
