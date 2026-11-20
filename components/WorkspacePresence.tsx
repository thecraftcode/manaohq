'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/useStore';

interface PresenceUser {
    user_id: string;
    name: string;
    avatar_url?: string;
    online_at: string;
}

const MAX_VISIBLE_AVATARS = 3;

/** Deterministic color from user_id for avatar fallback */
const avatarColors = [
    'bg-[#4F86C6]',     // Steel Blue
    'bg-[#001F5B]',     // Navy Blue
    'bg-emerald-500',
    'bg-violet-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-teal-500',
    'bg-indigo-500',
];

function getColor(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return avatarColors[Math.abs(hash) % avatarColors.length];
}

export default function WorkspacePresence() {
    const [activeUsers, setActiveUsers] = useState<PresenceUser[]>([]);
    const currentUserProfile = useStore((s) => s.currentUserProfile);
    const currentUser = useStore((s) => s.currentUser);
    const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);

    useEffect(() => {
        if (!activeWorkspaceId) return;

        let isMounted = true;

        const setupPresence = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user || !isMounted) return;

            const channel = supabase.channel(`room-workspace-${activeWorkspaceId}`, {
                config: { presence: { key: user.id } },
            });

            // ── Sync: full state reconciliation ──────────────────────────
            channel.on('presence', { event: 'sync' }, () => {
                if (!isMounted) return;
                const presenceState = channel.presenceState<PresenceUser>();
                const users: PresenceUser[] = [];
                const seen = new Set<string>();

                for (const key of Object.keys(presenceState)) {
                    const entries = presenceState[key];
                    for (const entry of entries) {
                        if (!seen.has(entry.user_id)) {
                            seen.add(entry.user_id);
                            users.push(entry);
                        }
                    }
                }

                setActiveUsers(users);
            });

            // ── Join ─────────────────────────────────────────────────────
            channel.on('presence', { event: 'join' }, ({ newPresences }) => {
                if (!isMounted) return;
                setActiveUsers((prev) => {
                    const updated = [...prev];
                    for (const p of newPresences as unknown as PresenceUser[]) {
                        if (!updated.some((u) => u.user_id === p.user_id)) {
                            updated.push(p);
                        }
                    }
                    return updated;
                });
            });

            // ── Leave ────────────────────────────────────────────────────
            channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
                if (!isMounted) return;
                const leftIds = new Set((leftPresences as unknown as PresenceUser[]).map((p) => p.user_id));
                setActiveUsers((prev) => prev.filter((u) => !leftIds.has(u.user_id)));
            });

            // ── Subscribe + track ────────────────────────────────────────
            await channel.subscribe(async (status) => {
                if (status === 'SUBSCRIBED' && isMounted) {
                    await channel.track({
                        user_id: user.id,
                        name: currentUserProfile?.name || currentUser || user.email?.split('@')[0] || 'User',
                        avatar_url: currentUserProfile?.avatar_url || null,
                        online_at: new Date().toISOString(),
                    });
                }
            });

            // ── Cleanup ──────────────────────────────────────────────────
            return () => {
                isMounted = false;
                channel.untrack();
                supabase.removeChannel(channel);
            };
        };

        const cleanupPromise = setupPresence();

        return () => {
            isMounted = false;
            cleanupPromise.then((cleanup) => cleanup?.());
        };
    }, [activeWorkspaceId, currentUser, currentUserProfile]);

    if (activeUsers.length === 0) return null;

    const visible = activeUsers.slice(0, MAX_VISIBLE_AVATARS);
    const overflow = activeUsers.length - MAX_VISIBLE_AVATARS;

    return (
        <div className="flex flex-row-reverse justify-end -space-x-2 -space-x-reverse items-center">
            {/* Overflow "+X" pill */}
            {overflow > 0 && (
                <div
                    className="relative z-0 flex items-center justify-center w-8 h-8 rounded-full bg-[#001F5B] ring-2 ring-surface-white dark:ring-gray-900 text-white text-[10px] font-bold select-none"
                    title={`${overflow} more online`}
                >
                    +{overflow}
                </div>
            )}

            {[...visible].reverse().map((user, idx) => {
                const initials = user.name
                    .split(' ')
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);

                return (
                    <div
                        key={user.user_id}
                        className={`relative flex items-center justify-center w-8 h-8 rounded-full ring-2 ring-surface-white dark:ring-gray-900 ${getColor(user.user_id)} text-white text-[10px] font-bold select-none transition-transform hover:scale-110 hover:z-10`}
                        style={{ zIndex: visible.length - idx }}
                        title={`${user.name} is online`}
                    >
                        {user.avatar_url ? (
                            <img
                                src={user.avatar_url}
                                alt={user.name}
                                className="w-full h-full rounded-full object-cover"
                            />
                        ) : (
                            initials
                        )}

                        {/* Green "online" dot */}
                        <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-400 border border-surface-white dark:border-gray-900 rounded-full" />
                    </div>
                );
            })}
        </div>
    );
}
