'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/useStore';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';

interface Notification {
    id: string;
    workspace_id?: string;
    recipient_id?: string;
    target_user?: string;
    title: string;
    message: string;
    type: string;
    is_read: boolean;
    created_at: string;
    post_id?: string | null;
}

interface NotificationDropdownProps {
    variant?: 'header' | 'sidebar';
    onPendingInviteChange?: (count: number) => void;
    onUnreadCountChange?: (count: number) => void;
}

export default function NotificationDropdown({ variant = 'header', onPendingInviteChange, onUnreadCountChange }: NotificationDropdownProps) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const ref = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const { setActiveView, activeWorkspaceId, fetchWorkspaces } = useStore();
    const t = useT();

    // Listen for custom event to open notification panel (from browser notification click)
    useEffect(() => {
        const handleOpenNotifications = () => setIsOpen(true);
        window.addEventListener('manao-open-notifications', handleOpenNotifications);
        return () => window.removeEventListener('manao-open-notifications', handleOpenNotifications);
    }, []);

    const unreadCount = notifications.filter(n => !n.is_read).length;
    const pendingInviteCount = notifications.filter(n => n.type === 'invite' && !n.is_read).length;

    // Notify parent about pending invite count changes
    useEffect(() => {
        onPendingInviteChange?.(pendingInviteCount);
    }, [pendingInviteCount, onPendingInviteChange]);

    // Notify parent about total unread count changes
    useEffect(() => {
        onUnreadCountChange?.(unreadCount);
    }, [unreadCount, onUnreadCountChange]);

    // Fetch notifications for the current authenticated user
    const fetchNotifications = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) return;

            const { data, error } = await supabase
                .from('in_app_notifications')
                .select('*')
                .eq('recipient_id', user.id)
                .order('created_at', { ascending: false });

            if (!error && data) setNotifications(data);
        } catch (err) {
            console.warn('Error fetching notifications:', err);
        }
    };

    // Initial fetch + Supabase Realtime subscription
    useEffect(() => {
        let isMounted = true;
        let channel: ReturnType<typeof supabase.channel> | null = null;

        // Fetch initial data
        fetchNotifications();

        // Re-fetch when user returns to this browser tab
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') fetchNotifications();
        };
        document.addEventListener('visibilitychange', handleVisibility);

        // Realtime: instant updates via WebSocket
        const setupRealtime = async () => {
            try {
                const { data: { session }, error: userErr } = await supabase.auth.getSession();
                const user = session?.user;
                if (userErr || !user) return;

                if (!isMounted) return;

                channel = supabase
                    .channel(`notifications-realtime-${user.id}`)
                    .on(
                        'postgres_changes',
                        {
                            event: 'INSERT',
                            schema: 'public',
                            table: 'in_app_notifications',
                            filter: `recipient_id=eq.${user.id}`, // Filter on DB side
                        },
                        (payload) => {
                            const newNotif = payload.new as Notification;
                            if (newNotif.recipient_id === user.id) {
                                setNotifications(prev => {
                                    if (prev.some(n => n.id === newNotif.id)) return prev;
                                    return [newNotif, ...prev];
                                });

                                // Show native browser/OS notification
                                if ('Notification' in window && Notification.permission === 'granted') {
                                    // Build deep-link URL for notification click
                                    let notifUrl = '/';
                                    if (newNotif.post_id) {
                                        notifUrl = `/?tab=content&workspace=${newNotif.workspace_id}&highlight_post=${newNotif.post_id}`;
                                    } else if (newNotif.type === 'invite') {
                                        notifUrl = '__open_notifications__';
                                    }

                                    try {
                                        const browserNotif = new window.Notification(newNotif.title || 'ManaoHQ', {
                                            body: newNotif.message || 'Ada pembaruan baru!',
                                            icon: '/logo-manao.svg',
                                            tag: `manao-${newNotif.id}`,
                                        });
                                        browserNotif.onclick = () => {
                                            window.focus();
                                            browserNotif.close();
                                            // Navigate to the relevant page
                                            if (notifUrl === '__open_notifications__') {
                                                window.dispatchEvent(new Event('manao-open-notifications'));
                                            } else {
                                                window.location.href = notifUrl;
                                            }
                                        };
                                    } catch (e) {
                                        // Fallback: some browsers require service worker for notifications
                                        navigator.serviceWorker?.ready?.then(reg => {
                                            reg.showNotification(newNotif.title || 'ManaoHQ', {
                                                body: newNotif.message || 'Ada pembaruan baru!',
                                                icon: '/logo-manao.svg',
                                                tag: `manao-${newNotif.id}`,
                                                data: { url: notifUrl },
                                            });
                                        }).catch(() => { });
                                    }
                                }
                            }
                        }
                    )
                    .on(
                        'postgres_changes',
                        {
                            event: 'UPDATE',
                            schema: 'public',
                            table: 'in_app_notifications',
                            filter: `recipient_id=eq.${user.id}`,
                        },
                        (payload) => {
                            const updatedNotif = payload.new as Notification;
                            setNotifications(prev =>
                                prev.map(n => (n.id === updatedNotif.id ? updatedNotif : n))
                            );
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
                            const deletedId = payload.old?.id;
                            if (deletedId) {
                                setNotifications(prev => prev.filter(n => n.id !== deletedId));
                            }
                        }
                    )
                    .subscribe();
            } catch (err) {
                console.warn('Realtime setup error:', err);
            }
        };

        setupRealtime();

        // Fallback: poll every 15 seconds to ensure badge updates even if WebSocket drops
        const fallbackInterval = setInterval(() => {
            if (document.visibilityState === 'visible') fetchNotifications();
        }, 15000);

        return () => {
            isMounted = false;
            document.removeEventListener('visibilitychange', handleVisibility);
            clearInterval(fallbackInterval);
            if (channel) {
                supabase.removeChannel(channel);
            }
        };
        // Disable exhaustive-deps warning here because we strictly want this effect
        // to run ONCE per mount to avoid recreating Realtime channels on unrelated re-renders.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Close popover when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Mark a single notification as read + navigate to the post
    const handleNotificationClick = async (notif: Notification) => {
        // Mark as read
        if (!notif.is_read) {
            const { error } = await supabase
                .from('in_app_notifications')
                .update({ is_read: true })
                .eq('id', notif.id);

            if (!error) {
                setNotifications(prev =>
                    prev.map(n => (n.id === notif.id ? { ...n, is_read: true } : n))
                );
            }
        }

        // Deep-link: navigate to Content Hub and highlight the specific post
        if (notif.post_id) {
            // Switch workspace if notification is from a different workspace
            if (notif.workspace_id && notif.workspace_id !== useStore.getState().activeWorkspaceId) {
                useStore.getState().setActiveWorkspace(notif.workspace_id);
                // Wait for workspace data to load
                await new Promise(r => setTimeout(r, 500));
            }
            // Re-fetch posts so the assigned post is available
            await useStore.getState().fetchPosts();
            setActiveView('content');
            // Include tab=content so MainCanvas syncs the view correctly
            router.push(`/?tab=content&workspace=${notif.workspace_id}&highlight_post=${notif.post_id}`);
        }

        setIsOpen(false);
    };

    // Mark all as read
    const markAllAsRead = async () => {
        const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
        if (unreadIds.length === 0) return;

        const { error } = await supabase
            .from('in_app_notifications')
            .update({ is_read: true })
            .in('id', unreadIds);

        if (!error) {
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        }
    };

    // Accept workspace invite
    const handleAcceptInvite = async (notif: Notification) => {
        setProcessingId(notif.id);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) return;

            // Use server-side API to insert into workspace_members (bypasses RLS)
            const res = await fetch('/api/accept-invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    notificationId: notif.id,
                    workspaceId: notif.workspace_id,
                    userId: user.id,
                    userEmail: user.email,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to accept invite');
            }

            setNotifications(prev =>
                prev.map(n => (n.id === notif.id ? { ...n, is_read: true } : n))
            );

            toast.success('You joined the workspace!');

            // ── Force instant layout sync ──
            await fetchWorkspaces();
            if (notif.workspace_id) {
                useStore.getState().setActiveWorkspace(notif.workspace_id);
                await useStore.getState().fetchPosts();
                setActiveView('content');
                router.push(`/?tab=content&workspace=${notif.workspace_id}`);
            }
        } catch (err: any) {
            console.error('Error accepting invite:', err);
            toast.error(err?.message || 'Failed to accept invite');
        } finally {
            setProcessingId(null);
        }
    };

    // Reject workspace invite
    const handleRejectInvite = async (notif: Notification) => {
        setProcessingId(notif.id);
        try {
            await supabase
                .from('in_app_notifications')
                .delete()
                .eq('id', notif.id);

            setNotifications(prev => prev.filter(n => n.id !== notif.id));
            toast('Invite declined');
        } catch (err: any) {
            console.error('Error rejecting invite:', err);
            toast.error('Failed to decline invite');
        } finally {
            setProcessingId(null);
        }
    };

    // Icon color based on notification type
    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'deadline': return { icon: 'schedule', color: 'text-amber-500' };
            case 'info': return { icon: 'info', color: 'text-blue-500' };
            case 'success': return { icon: 'check_circle', color: 'text-emerald-500' };
            case 'warning': return { icon: 'warning', color: 'text-orange-500' };
            case 'assignment': return { icon: 'person_add', color: 'text-indigo-500' };
            case 'invite': return { icon: 'group_add', color: 'text-emerald-500' };
            default: return { icon: 'notifications', color: 'text-slate-400' };
        }
    };

    return (
        <div className="relative" ref={ref}>
            {/* Bell Button */}
            {variant === 'header' && (
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-white dark:bg-gray-800 border border-border-subtle text-text-muted hover:text-primary hover:border-primary transition-colors relative"
                >
                    <span className="material-symbols-outlined">notifications</span>
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold border-2 border-white dark:border-gray-800 px-1">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>
            )}

            {/* Popover Dropdown */}
            {(variant === 'sidebar' || isOpen) && (
                <div className={`w-80 bg-surface-white dark:bg-gray-800 border border-border-subtle rounded-2xl shadow-xl overflow-hidden flex flex-col ${variant !== 'sidebar'
                    ? 'absolute z-50 top-full right-0 mt-2'
                    : ''
                    }`}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
                        <h3 className="text-sm font-bold text-text-main dark:text-gray-100">{t.notif_title}</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-xs font-semibold text-primary hover:text-primary-hover transition-colors"
                            >
                                {t.notif_mark_read}
                            </button>
                        )}
                    </div>

                    {/* Notification List */}
                    <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 gap-2 text-text-muted">
                                <span className="material-symbols-outlined text-4xl opacity-30">notifications_off</span>
                                <p className="text-sm">{t.notif_empty}</p>
                            </div>
                        ) : (
                            notifications.map((notif) => {
                                const typeInfo = getTypeIcon(notif.type);
                                const isInvitePending = notif.type === 'invite' && !notif.is_read;
                                const isProcessing = processingId === notif.id;

                                return (
                                    <div
                                        key={notif.id}
                                        onClick={() => !isInvitePending && handleNotificationClick(notif)}
                                        className={`w-full text-left flex items-start gap-3 px-4 py-3 transition-colors hover:bg-background-light dark:hover:bg-gray-700/50 border-b border-border-subtle/50 last:border-b-0 ${!notif.is_read
                                            ? 'bg-primary/5 dark:bg-primary/10'
                                            : ''
                                            } ${isInvitePending ? '' : 'cursor-pointer'}`}
                                    >
                                        {/* Type Icon */}
                                        <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${!notif.is_read ? 'bg-primary/10 dark:bg-primary/20' : 'bg-slate-100 dark:bg-gray-700'
                                            }`}>
                                            <span className={`material-symbols-outlined text-[18px] ${typeInfo.color}`}>
                                                {typeInfo.icon}
                                            </span>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className={`text-sm truncate ${!notif.is_read
                                                    ? 'font-bold text-text-main dark:text-gray-100'
                                                    : 'font-medium text-text-muted dark:text-gray-400'
                                                    }`}>
                                                    {notif.title}
                                                </p>
                                                {!notif.is_read && (
                                                    <span className="shrink-0 w-2 h-2 rounded-full bg-primary"></span>
                                                )}
                                            </div>
                                            <p className="text-xs text-text-muted dark:text-gray-500 mt-0.5 line-clamp-2">
                                                {notif.message}
                                            </p>

                                            {/* Accept / Reject buttons for pending invites */}
                                            {isInvitePending ? (
                                                <div className="flex items-center gap-2 mt-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleAcceptInvite(notif); }}
                                                        disabled={isProcessing}
                                                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50"
                                                    >
                                                        {isProcessing ? (
                                                            <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                                                        ) : (
                                                            <span className="material-symbols-outlined text-[14px]">check</span>
                                                        )}
                                                        {t.notif_accept}
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleRejectInvite(notif); }}
                                                        disabled={isProcessing}
                                                        className="flex items-center gap-1 px-3 py-1.5 border border-border-subtle dark:border-gray-600 text-text-muted hover:text-red-500 hover:border-red-300 dark:hover:border-red-500/30 text-xs font-bold rounded-lg transition-all disabled:opacity-50"
                                                    >
                                                        <span className="material-symbols-outlined text-[14px]">close</span>
                                                        {t.notif_decline}
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 mt-1">
                                                    <p className="text-[11px] text-text-muted/60 dark:text-gray-600">
                                                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                                                    </p>
                                                    {notif.type === 'invite' && notif.is_read && (
                                                        <span className="text-[10px] font-semibold text-emerald-500/70">
                                                            • {t.notif_accepted} ✓
                                                        </span>
                                                    )}
                                                    {notif.post_id && (
                                                        <span className="text-[10px] font-semibold text-primary/60 dark:text-primary/40">
                                                            • {t.notif_view_post} →
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
