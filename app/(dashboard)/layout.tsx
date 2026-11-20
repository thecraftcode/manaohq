'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/useStore';
import Sidebar from '@/components/Sidebar';
import InviteAcceptModal from '@/components/InviteAcceptModal';
import Image from 'next/image';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const {
        focusMode,
        mobileMenuOpen,
        toggleMobileMenu,
        setMobileMenuOpen,
        sidebarCollapsed,
        fetchPosts,
        fetchTeamMembers,
        fetchCurrentUserProfile,
        fetchWorkspaces,
        fetchTags,
        fetchNotificationPrefs,
        workspaces,
    } = useStore();

    const router = useRouter();
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);
    const [notificationBlocked, setNotificationBlocked] = useState(false);

    // Auto-clean bloated legacy localStorage cache on initial load
    useEffect(() => {
        try {
            const raw = localStorage.getItem('manaohq-storage-v2');
            if (raw && (raw.includes('"posts":') || raw.length > 200000)) {
                localStorage.removeItem('manaohq-storage-v2');
                console.log('🧹 Purged bloated legacy cache from localStorage');
            }
        } catch (e) {
            console.warn('Storage purge notice:', e);
        }
    }, []);

    // Listen for Service Worker postMessage (from notification clicks)
    // This allows instant client-side navigation instead of a full page reload
    useEffect(() => {
        const handleSWMessage = async (event: MessageEvent) => {
            if (event.data?.type === 'NOTIFICATION_CLICK' && event.data?.url) {
                const url = event.data.url as string;
                const urlParams = new URLSearchParams(url.split('?')[1] || '');
                const targetWorkspace = urlParams.get('workspace');
                const highlightPost = urlParams.get('highlight_post');
                const targetTab = urlParams.get('tab');

                // Switch workspace if needed
                if (targetWorkspace && targetWorkspace !== useStore.getState().activeWorkspaceId) {
                    useStore.getState().setActiveWorkspace(targetWorkspace);
                    // Wait a moment for workspace data to load
                    await new Promise(r => setTimeout(r, 500));
                }

                // Re-fetch posts to get latest data
                await useStore.getState().fetchPosts();

                // Sync the view based on URL tab parameter
                if (targetTab) {
                    useStore.getState().setActiveView(targetTab as any);
                } else if (highlightPost) {
                    useStore.getState().setActiveView('content');
                }

                router.push(url);
            }
        };

        navigator.serviceWorker?.addEventListener('message', handleSWMessage);
        return () => {
            navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
        };
    }, [router]);

    useEffect(() => {
        const checkSession = async () => {
            try {
                const {
                    data: { session },
                    error,
                } = await supabase.auth.getSession();

                if (error || !session) {
                    if (error) console.error('Session error:', error.message);
                    await supabase.auth.signOut();
                    router.push('/login');
                } else {
                    setIsLoadingAuth(false);
                    // Fetch workspace first, then fetch dependent data in parallel
                    await fetchWorkspaces();
                    fetchPosts();
                    fetchTeamMembers();
                    fetchCurrentUserProfile();
                    fetchTags();
                    fetchNotificationPrefs();
                }
            } catch (err) {
                console.error('Unexpected session check error:', err);
                await supabase.auth.signOut();
                router.push('/login');
            }
        };

        checkSession();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) {
                router.push('/login');
            } else {
                setIsLoadingAuth(false);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [router]);

    // Global Realtime Sync for Posts, Members, and Team
    useEffect(() => {
        if (isLoadingAuth) return;

        // Debounce helper to avoid rapid-fire refetches
        let postsTimer: NodeJS.Timeout | null = null;
        let membersTimer: NodeJS.Timeout | null = null;

        const debouncedFetchPosts = () => {
            if (postsTimer) clearTimeout(postsTimer);
            postsTimer = setTimeout(() => {
                useStore.getState().fetchPosts();
            }, 300);
        };

        const debouncedFetchMembers = () => {
            if (membersTimer) clearTimeout(membersTimer);
            membersTimer = setTimeout(() => {
                useStore.getState().fetchTeamMembers();
            }, 300);
        };

        // When a member is removed, handle PIC clearing and self-removal redirect
        const handleMemberRemoved = async (payload: any) => {
            debouncedFetchMembers();

            if (payload.eventType === 'DELETE' && payload.old) {
                const deletedEmail = payload.old.user_name;
                const deletedWsId = payload.old.workspace_id;
                if (!deletedEmail || !deletedWsId) return;

                // Check if the removed member is the current user
                const currentProfile = useStore.getState().currentUserProfile;
                const currentWsId = useStore.getState().activeWorkspaceId;
                if (currentProfile?.email?.toLowerCase() === deletedEmail.toLowerCase() && currentWsId === deletedWsId) {
                    // Current user was removed from this workspace — auto-redirect
                    const { toast } = await import('sonner');
                    toast.info('Anda telah dikeluarkan dari workspace ini.');
                    // Re-fetch workspaces — this will auto-select another workspace or clear to empty state
                    await useStore.getState().fetchWorkspaces();
                    return; // No need to do PIC cleanup from removed user's side
                }

                // Find the display name for this email from the current teamMembers
                const store = useStore.getState();
                const member = store.teamMembers.find(
                    m => m.email?.toLowerCase() === deletedEmail.toLowerCase()
                );
                const displayName = member?.name || deletedEmail.split('@')[0];

                // Batch update all posts in this workspace that had this member as PIC
                const { error } = await supabase
                    .from('posts')
                    .update({ pic: 'Unassigned' })
                    .eq('workspace_id', deletedWsId)
                    .eq('pic', displayName);

                if (error) {
                    console.warn('Auto-unassign PIC error:', error.message);
                }

                // Also try matching by email prefix in case PIC was stored differently
                const emailPrefix = deletedEmail.split('@')[0];
                if (emailPrefix !== displayName) {
                    await supabase
                        .from('posts')
                        .update({ pic: 'Unassigned' })
                        .eq('workspace_id', deletedWsId)
                        .eq('pic', emailPrefix);
                }

                // Refetch posts to reflect changes
                debouncedFetchPosts();
            }
        };

        const channel = supabase
            .channel('global-data-sync')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'posts' },
                () => debouncedFetchPosts()
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'posts' },
                () => debouncedFetchPosts()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'workspace_members' },
                (payload) => handleMemberRemoved(payload)
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'team_members' },
                () => debouncedFetchMembers()
            )
            .subscribe();

        return () => {
            if (postsTimer) clearTimeout(postsTimer);
            if (membersTimer) clearTimeout(membersTimer);
            supabase.removeChannel(channel);
        };
    }, [isLoadingAuth]);

    // Auto-subscribe to Push Notifications
    useEffect(() => {
        if (isLoadingAuth) return;

        const autoSubscribeToPush = async () => {
            try {
                if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
                // Push notifications require a secure context (HTTPS or localhost)
                if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') return;

                const currentPerf = Notification.permission;
                if (currentPerf === 'denied') {
                    setNotificationBlocked(true);
                    return;
                }

                if (currentPerf === 'default') {
                    await new Promise(r => setTimeout(r, 2000));
                }

                const permission = await Notification.requestPermission();
                if (permission === 'denied') {
                    setNotificationBlocked(true);
                    return;
                }

                if (permission === 'granted') {
                    setNotificationBlocked(false);
                    const registration = await navigator.serviceWorker.ready;
                    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
                    if (!vapidPublicKey) return;

                    const urlBase64ToUint8Array = (base64String: string) => {
                        const padding = '='.repeat((4 - base64String.length % 4) % 4);
                        const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
                        const rawData = window.atob(base64);
                        const outputArray = new Uint8Array(rawData.length);
                        for (let i = 0; i < rawData.length; ++i) {
                            outputArray[i] = rawData.charCodeAt(i);
                        }
                        return outputArray;
                    };

                    let pushSubscription;
                    try {
                        pushSubscription = await registration.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
                        });
                    } catch (pushErr) {
                        // Push service error is expected if the server is not reachable
                        console.debug('[Push] Push subscription not available:', (pushErr as Error)?.message);
                        return;
                    }

                    const { data: { session } } = await supabase.auth.getSession();
                    const user = session?.user;
                    if (user) {
                        // Check if we already have this exact endpoint saved to avoid duplicates
                        const { data: existingSub } = await supabase
                            .from('push_subscriptions')
                            .select('id')
                            .eq('user_id', user.id)
                            .eq('subscription->>endpoint', pushSubscription.endpoint)
                            .maybeSingle();

                        if (!existingSub) {
                            await supabase.from('push_subscriptions').insert({
                                user_id: user.id,
                                subscription: pushSubscription as any,
                            });
                        }
                    }
                }
            } catch (err) {
                console.debug('[Push] Push notification setup skipped:', (err as Error)?.message || err);
            }
        };

        autoSubscribeToPush();
    }, [isLoadingAuth]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    if (isLoadingAuth) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background-light dark:bg-background-dark">
                <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
            </div>
        );
    }

    // Sidebar always shows full nav
    const sidebarMinimal = false;

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-background-light dark:bg-background-dark relative">
            {/* Warning Banner for Blocked Notifications */}
            {notificationBlocked && (
                <div className="flex items-center justify-center gap-2 w-full bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/20 px-4 py-2 flex-shrink-0 relative z-50">
                    <span className="text-amber-800 dark:text-amber-400 text-sm font-medium">
                        ⚠️ Aktifkan setelan notifikasi browser untuk menerima update tugas penting.
                    </span>
                    <button
                        onClick={() => setNotificationBlocked(false)}
                        className="ml-2 text-amber-600 dark:text-amber-500 hover:text-amber-800 dark:hover:text-amber-300 transition-colors"
                        title="Dismiss"
                    >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                </div>
            )}

            <div className="flex flex-1 overflow-hidden relative">
                {/* Mobile Top Bar */}
                {!focusMode && (
                    <div className={`md:hidden absolute top-0 left-0 right-0 h-16 bg-surface-white dark:bg-gray-900 border-b border-border-subtle z-30 flex items-center justify-between px-4 transition-all`}>
                        <div className="flex items-center gap-3">
                            <div className="relative flex-shrink-0 w-8 h-8 rounded-lg bg-[#3E88B0] overflow-hidden shadow-sm flex items-center justify-center">
                                <Image src="/logo-manao.svg" alt="ManaoHQ Logo" fill className="object-cover scale-105" />
                            </div>
                            <div className="flex flex-col justify-center">
                                <span className="text-text-main dark:text-white font-bold text-base leading-none tracking-tight">ManaoHQ</span>
                                <span className="text-text-muted text-[10px] font-semibold mt-1 uppercase tracking-wider leading-none">Command the Chaos</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 pl-3 border-l border-border-subtle">
                            <button
                                onClick={handleLogout}
                                className="p-1.5 text-text-muted hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                                aria-label="Logout"
                            >
                                <span className="material-symbols-outlined text-[20px]">logout</span>
                            </button>
                            <button
                                onClick={toggleMobileMenu}
                                className="p-1.5 -mr-1 text-text-muted hover:text-primary rounded-lg hover:bg-[#e6f0f5] transition-colors"
                            >
                                <span className="material-symbols-outlined text-[24px]">menu</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Sidebar with Mobile Support — ALWAYS visible for all authenticated users */}
                {!focusMode && (
                    <>
                        <div
                            className={`md:hidden fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40 transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                            onClick={() => setMobileMenuOpen(false)}
                        />
                        <div
                            className={`fixed inset-y-0 left-0 z-50 transform transition-all duration-300 ease-in-out md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} ${sidebarCollapsed ? 'w-20' : 'w-64'}`}
                        >
                            <Sidebar minimal={sidebarMinimal} />
                        </div>
                    </>
                )}

                {/* Main content */}
                <div
                    className={`flex-1 w-full h-full overflow-hidden transition-all duration-300 ${!focusMode ? (sidebarCollapsed ? 'md:ml-20 pt-16 md:pt-0' : 'md:ml-64 pt-16 md:pt-0') : ''}`}
                >
                    {children}
                    <InviteAcceptModal />
                </div>
            </div>
        </div>
    );
}
