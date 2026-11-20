'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Loader2, AlertTriangle, Users, Shield, User, Pencil, Check, Tag } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/useStore';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';

interface WorkspaceMemberRow {
    id: string;
    workspace_id: string;
    user_name: string;
    role: string;
    created_at?: string;
    job_role?: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export default function WorkspaceSettingsModal({ isOpen, onClose }: Props) {
    const { activeWorkspaceId, activeRole, workspaces, fetchWorkspaces, setActiveWorkspace, setActiveView, setActiveSettingsTab, currentUserProfile } = useStore();
    const router = useRouter();
    const hasAdminAccess = ['owner', 'admin'].includes(activeRole?.toLowerCase() || '');

    const [members, setMembers] = useState<WorkspaceMemberRow[]>([]);
    const [inviteEmail, setInviteEmail] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isLoadingMembers, setIsLoadingMembers] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState('');
    const [isSavingName, setIsSavingName] = useState(false);
    const [inviteRole, setInviteRole] = useState('Member');

    // Email autocomplete
    const [emailSuggestions, setEmailSuggestions] = useState<{ email: string }[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
    const suggestionsRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const suggestTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch email suggestions from profiles table
    const fetchSuggestions = useCallback(async (query: string) => {
        if (!query || query.length < 1) {
            setEmailSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const currentEmail = user?.email?.toLowerCase() || '';

            // Query profiles table for matching emails
            const { data, error } = await supabase
                .from('profiles')
                .select('email')
                .ilike('email', `%${query}%`)
                .limit(8);

            if (error || !data) {
                setEmailSuggestions([]);
                return;
            }

            // Filter out current user and already-added members
            const memberEmails = members.map(m => m.user_name?.toLowerCase());
            const filtered = data.filter(p =>
                p.email &&
                p.email.toLowerCase() !== currentEmail &&
                !memberEmails.includes(p.email.toLowerCase())
            );

            setEmailSuggestions(filtered);
            setShowSuggestions(filtered.length > 0);
            setActiveSuggestionIndex(-1);
        } catch {
            setEmailSuggestions([]);
        }
    }, [members]);

    // Debounced email search
    useEffect(() => {
        if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
        suggestTimerRef.current = setTimeout(() => {
            fetchSuggestions(inviteEmail.trim());
        }, 150);
        return () => {
            if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
        };
    }, [inviteEmail, fetchSuggestions]);

    // Close suggestions on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
                inputRef.current && !inputRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleSuggestionSelect = (email: string) => {
        setInviteEmail(email);
        setShowSuggestions(false);
        setEmailSuggestions([]);
    };

    const handleEmailKeyDown = (e: React.KeyboardEvent) => {
        if (!showSuggestions || emailSuggestions.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveSuggestionIndex(prev => Math.min(prev + 1, emailSuggestions.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveSuggestionIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && activeSuggestionIndex >= 0) {
            e.preventDefault();
            handleSuggestionSelect(emailSuggestions[activeSuggestionIndex].email);
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    };

    const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

    // Only owners and admins can manage settings (check deferred to render block)


    useEffect(() => {
        if (isOpen) {
            if (!activeWorkspaceId) {
                // If modal is open but user has no workspace, force close it
                onClose();
                return;
            }
            fetchMembers();
            setShowDeleteConfirm(false);
            setIsEditingName(false);
            setEditedName(activeWorkspace?.name || '');
        }
    }, [isOpen, activeWorkspaceId, activeWorkspace?.name]);

    const t = useT();

    const fetchMembers = async () => {
        if (!activeWorkspaceId) return;
        setIsLoadingMembers(true);
        try {
            const { data, error } = await supabase
                .from('workspace_members')
                .select('*')
                .eq('workspace_id', activeWorkspaceId)
                .order('created_at', { ascending: true });
            if (error) throw error;
            if (data) {
                // Map job roles synchronously from the globally cached teamMembers store
                const globalTeam = useStore.getState().teamMembers || [];
                const membersWithJobs = data.map(m => {
                    const foundProfile = globalTeam.find(t => t.email === m.user_name);
                    return { ...m, job_role: foundProfile?.role || 'Team Member' };
                });
                setMembers(membersWithJobs as WorkspaceMemberRow[]);
            }
        } catch (err) {
            console.warn('Error fetching workspace members:', err);
        } finally {
            setIsLoadingMembers(false);
        }
    };

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        const targetEmail = inviteEmail.trim().toLowerCase();
        if (!targetEmail || !activeWorkspaceId) return;

        setIsAdding(true);
        try {
            // Quick client-side self-invite check
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email?.toLowerCase() === targetEmail) {
                toast.error('Anda tidak bisa mengundang diri sendiri.');
                setIsAdding(false);
                return;
            }

            console.log('[Invite] Sending invite to:', targetEmail, 'workspace:', activeWorkspaceId);

            const res = await fetch('/api/invite-member', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: targetEmail,
                    workspaceId: activeWorkspaceId,
                    workspaceName: activeWorkspace?.name,
                    inviterId: user?.id,
                    role: inviteRole,
                }),
            });

            const text = await res.text();
            console.log('[Invite] Response status:', res.status, 'body:', text);
            let data: any = {};
            try { data = JSON.parse(text); } catch { data = { error: 'Respons tidak valid dari server' }; }

            if (!res.ok) {
                toast.error(data.error || 'Gagal mengirim undangan');
                return;
            }

            setInviteEmail('');
            toast.success(data.message || `Undangan berhasil dikirim ke ${targetEmail}!`);
        } catch (err: any) {
            console.error('Error sending invite:', err);
            toast.error(err?.message || 'Gagal mengirim undangan');
        } finally {
            setIsAdding(false);
        }
    };

    const handleRemoveMember = async (memberId: string, memberEmail: string) => {
        try {
            // 1. Find the display name this member uses in the PIC column
            const globalTeam = useStore.getState().teamMembers || [];
            const found = globalTeam.find(t => t.email?.toLowerCase() === memberEmail.toLowerCase());
            const displayName = found?.name || memberEmail.split('@')[0];
            const emailPrefix = memberEmail.split('@')[0];

            // 2. Delete the member from workspace_members
            const { error } = await supabase
                .from('workspace_members')
                .delete()
                .eq('id', memberId);
            if (error) throw error;

            // 3. Clear PIC from all posts that were assigned to this member
            if (activeWorkspaceId) {
                // Clear by display name
                await supabase
                    .from('posts')
                    .update({ pic: 'Unassigned' })
                    .eq('workspace_id', activeWorkspaceId)
                    .eq('pic', displayName);

                // Also clear by email prefix (in case PIC was stored differently)
                if (emailPrefix !== displayName) {
                    await supabase
                        .from('posts')
                        .update({ pic: 'Unassigned' })
                        .eq('workspace_id', activeWorkspaceId)
                        .eq('pic', emailPrefix);
                }

                // Also clear by full email
                await supabase
                    .from('posts')
                    .update({ pic: 'Unassigned' })
                    .eq('workspace_id', activeWorkspaceId)
                    .eq('pic', memberEmail);
            }

            toast.success(`${displayName} dihapus dari workspace`);

            // 4. Refresh members list and posts
            fetchMembers();
            useStore.getState().fetchTeamMembers();
            useStore.getState().fetchPosts();
        } catch (err: any) {
            toast.error(err?.message || 'Failed to remove member');
        }
    };

    const handleDeleteWorkspace = async () => {
        if (!activeWorkspaceId) return;
        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('workspaces')
                .delete()
                .eq('id', activeWorkspaceId);
            if (error) throw error;

            toast.success('Workspace deleted');
            onClose();

            await fetchWorkspaces();
            const remaining = useStore.getState().workspaces;
            if (remaining.length > 0) {
                setActiveWorkspace(remaining[0].id);
            } else {
                useStore.setState({ activeWorkspaceId: null, posts: [], rawIdeas: [] });
            }
        } catch (err: any) {
            console.error('Error deleting workspace:', err);
            toast.error(err?.message || 'Failed to delete workspace');
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    if (!isOpen || !activeWorkspaceId || !hasAdminAccess) return null;

    const roleIcon = (role: string) => {
        if (role.toLowerCase() === 'owner') return <Shield className="w-3.5 h-3.5 text-amber-500" />;
        return <User className="w-3.5 h-3.5 text-text-muted" />;
    };

    return createPortal(
        <>
            <div className="fixed inset-0 z-[60] bg-gray-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed inset-0 z-[61] flex items-center justify-center p-4">
                <div
                    className="bg-surface-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-border-subtle w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle/30 dark:border-gray-800 flex-shrink-0">
                        <div>
                            <h3 className="font-bold text-text-main dark:text-white text-lg">{t.ws_settings}</h3>
                            <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                                {activeWorkspace?.name || 'Unknown'}
                            </p>
                        </div>
                        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-background-light dark:hover:bg-gray-800 text-text-muted hover:text-text-main transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Scrollable body */}
                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

                        {/* Section: Workspace Name */}
                        <div>
                            <label className="block text-xs font-semibold text-text-muted mb-1.5">{t.ws_name}</label>
                            {!isEditingName ? (
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-bold text-text-main dark:text-gray-100">{activeWorkspace?.name}</p>
                                    {hasAdminAccess && (
                                        <button
                                            onClick={() => { setIsEditingName(true); setEditedName(activeWorkspace?.name || ''); }}
                                            className="p-1 rounded-md hover:bg-background-light dark:hover:bg-gray-800 text-text-muted hover:text-primary transition-colors"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <form
                                    onSubmit={async (e) => {
                                        e.preventDefault();
                                        if (!editedName.trim() || !activeWorkspaceId) return;
                                        setIsSavingName(true);
                                        try {
                                            const { error } = await supabase
                                                .from('workspaces')
                                                .update({ name: editedName.trim() })
                                                .eq('id', activeWorkspaceId);
                                            if (error) throw error;
                                            await fetchWorkspaces();
                                            setIsEditingName(false);
                                            toast.success(t.ws_renamed);
                                        } catch (err: any) {
                                            toast.error(err?.message || t.ws_rename_fail);
                                        } finally {
                                            setIsSavingName(false);
                                        }
                                    }}
                                    className="flex gap-2"
                                >
                                    <input
                                        type="text"
                                        value={editedName}
                                        onChange={(e) => setEditedName(e.target.value)}
                                        autoFocus
                                        className="flex-1 text-sm border border-border-subtle dark:border-gray-700 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background-light dark:bg-gray-800 text-text-main dark:text-white transition-colors"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!editedName.trim() || isSavingName}
                                        className="flex items-center gap-1.5 px-3.5 py-2.5 bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-xl shadow-sm transition-all disabled:opacity-50"
                                    >
                                        {isSavingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                        {t.save}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsEditingName(false)}
                                        className="px-3 py-2.5 text-sm text-text-muted hover:text-text-main rounded-xl hover:bg-background-light dark:hover:bg-gray-800 transition-colors"
                                    >
                                        {t.cancel}
                                    </button>
                                </form>
                            )}
                        </div>

                        {/* Tags Manager Link */}
                        {hasAdminAccess && (
                            <button
                                onClick={() => { router.push('/?tab=tags'); setActiveView('tags'); onClose(); }}
                                className="w-full flex items-center justify-between p-4 bg-background-light dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 border border-border-subtle dark:border-gray-700/50 rounded-xl transition-all group mb-4"
                            >
                                <div className="text-left">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Tag className="w-4 h-4 text-primary" />
                                        <h4 className="font-bold text-text-main dark:text-gray-100 text-sm group-hover:text-primary transition-colors">{t.ws_tags}</h4>
                                    </div>
                                    <p className="text-[11px] text-text-muted">{t.ws_tags_desc}</p>
                                </div>
                                <span className="material-symbols-outlined text-text-muted text-[18px] group-hover:text-primary transition-colors">chevron_right</span>
                            </button>
                        )}

                        {/* Section A: Members */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-primary" />
                                    <h4 className="font-bold text-text-main dark:text-gray-100 text-sm">{t.ws_members}</h4>
                                    <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                        {members.length}
                                    </span>
                                </div>
                                <button
                                    onClick={(e) => { e.preventDefault(); fetchMembers(); }}
                                    disabled={isLoadingMembers}
                                    className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50"
                                    title="Muat ulang anggota"
                                >
                                    <span className={`material-symbols-outlined text-[16px] ${isLoadingMembers ? 'animate-spin' : ''}`}>
                                        refresh
                                    </span>
                                </button>
                            </div>
                            {hasAdminAccess && (
                                <>
                                    <p className="text-sm text-text-muted mb-4">
                                        {t.ws_invite_desc}
                                    </p>
                                    <form onSubmit={handleAddMember} className="flex gap-2 mb-4">
                                        <div className="flex-1 relative">
                                            <input
                                                ref={inputRef}
                                                type="email"
                                                placeholder={t.ws_invite_placeholder}
                                                className="w-full bg-background-light dark:bg-gray-800 border border-border-subtle rounded-xl px-4 py-2 text-sm text-text-main focus:outline-none focus:border-primary transition-colors"
                                                value={inviteEmail}
                                                onChange={(e) => setInviteEmail(e.target.value)}
                                                onFocus={() => { if (emailSuggestions.length > 0) setShowSuggestions(true); }}
                                                onKeyDown={handleEmailKeyDown}
                                                disabled={isAdding}
                                                required
                                                autoComplete="off"
                                            />
                                            {showSuggestions && emailSuggestions.length > 0 && (
                                                <div ref={suggestionsRef} className="absolute left-0 right-0 top-full mt-1 bg-surface-white dark:bg-gray-800 border border-border-subtle dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100">
                                                    <div className="py-1 max-h-[200px] overflow-y-auto">
                                                        <p className="px-3 py-1.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Pengguna Terdaftar</p>
                                                        {emailSuggestions.map((s, i) => (
                                                            <button
                                                                key={s.email}
                                                                type="button"
                                                                onMouseDown={(e) => { e.preventDefault(); handleSuggestionSelect(s.email); }}
                                                                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${i === activeSuggestionIndex ? 'bg-primary/10 text-primary' : 'text-text-main dark:text-gray-200 hover:bg-background-light dark:hover:bg-gray-700'}`}
                                                            >
                                                                <div className="w-6 h-6 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary text-[10px] font-bold flex-shrink-0">
                                                                    {s.email.charAt(0).toUpperCase()}
                                                                </div>
                                                                <span className="truncate font-medium">{s.email}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <select
                                            value={inviteRole}
                                            onChange={(e) => setInviteRole(e.target.value)}
                                            disabled={isAdding}
                                            className="bg-background-light dark:bg-gray-800 border border-border-subtle rounded-xl px-3 py-2 text-sm text-text-main focus:outline-none focus:border-primary transition-colors"
                                        >
                                            <option value="Admin">Admin</option>
                                            <option value="Member">Member</option>
                                        </select>
                                        <button
                                            type="submit"
                                            disabled={!inviteEmail.trim() || isAdding}
                                            className="flex items-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                            {t.ws_invite_btn}
                                        </button>
                                    </form>
                                </>
                            )}

                            <div className="bg-background-light dark:bg-gray-800/50 rounded-xl border border-border-subtle/50 dark:border-gray-700/50 overflow-hidden">
                                {isLoadingMembers ? (
                                    <div className="py-8 text-center">
                                        <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
                                    </div>
                                ) : members.length === 0 ? (
                                    <div className="py-8 text-center text-text-muted text-sm">{t.ws_no_members}</div>
                                ) : (
                                    <ul className="divide-y divide-border-subtle/30 dark:divide-gray-700/50">
                                        {members.map((member) => (
                                            <li key={member.id} className="flex items-center justify-between px-4 py-3 group hover:bg-surface-white dark:hover:bg-gray-800 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                                                        {member.user_name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-semibold text-text-main dark:text-gray-100">{member.user_name}</p>
                                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${member.role?.toLowerCase() === 'owner' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : member.role?.toLowerCase() === 'admin' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                                                                {member.role?.toLowerCase() === 'owner' ? 'Owner' : member.role?.toLowerCase() === 'admin' ? 'Admin' : 'Member'}
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] text-text-muted flex items-center gap-1">
                                                            {member.job_role || t.ws_team_member}
                                                        </p>
                                                    </div>
                                                </div>
                                                {hasAdminAccess && member.user_name !== currentUserProfile?.email && member.role?.toLowerCase() !== 'owner' && (
                                                    <button
                                                        onClick={() => handleRemoveMember(member.id, member.user_name || 'User')}
                                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                        title={t.ws_remove_member}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>

                        {/* Section B: Danger Zone */}
                        {hasAdminAccess && (
                            <div className="border border-red-200 dark:border-red-500/20 rounded-xl overflow-hidden">
                                <div className="px-4 py-3 bg-red-50 dark:bg-red-500/5 border-b border-red-200 dark:border-red-500/20">
                                    <h4 className="text-sm font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4" />
                                        {t.ws_danger}
                                    </h4>
                                </div>
                                <div className="px-4 py-4">
                                    {!showDeleteConfirm ? (
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-semibold text-text-main dark:text-gray-200">{t.ws_delete}</p>
                                                <p className="text-xs text-text-muted mt-0.5">{t.ws_delete_perm}</p>
                                            </div>
                                            <button
                                                onClick={() => setShowDeleteConfirm(true)}
                                                className="px-4 py-2 text-sm font-bold text-red-600 dark:text-red-400 border border-red-300 dark:border-red-500/30 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                            >
                                                {t.delete}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-500/10 rounded-lg">
                                                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                                <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                                                    {t.ws_delete_confirm_text} <strong>{t.ws_permanently_delete}</strong> {t.ws_all_data_inside} &quot;<strong>{activeWorkspace?.name}</strong>&quot;. {t.ws_cannot_undo}
                                                </p>
                                            </div>
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => setShowDeleteConfirm(false)}
                                                    className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-main rounded-xl hover:bg-background-light dark:hover:bg-gray-800 transition-colors"
                                                >
                                                    {t.cancel}
                                                </button>
                                                <button
                                                    onClick={handleDeleteWorkspace}
                                                    disabled={isDeleting}
                                                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all disabled:opacity-50"
                                                >
                                                    {isDeleting ? (
                                                        <><Loader2 className="w-4 h-4 animate-spin" /> {t.ws_deleting}</>
                                                    ) : (
                                                        <><Trash2 className="w-4 h-4" /> {t.ws_yes_delete}</>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
}
