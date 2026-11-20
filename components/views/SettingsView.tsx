'use client';

import { useStore } from '@/store/useStore';
import { supabase } from '@/lib/supabase';
import { User, Palette, Camera, Trash2, Loader2, Bell } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { ThemeToggle } from '../ThemeToggle';
import { useT } from '@/lib/i18n';
import type { Language } from '@/lib/i18n';

const avatarColors = [
    'from-pink-500 to-orange-400',
    'from-sky-500 to-indigo-500',
    'from-emerald-500 to-teal-500',
    'from-brand-500 to-purple-600',
    'from-amber-500 to-red-500',
    'from-cyan-500 to-blue-500',
    'from-rose-500 to-pink-600',
];

function getAvatarColor(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitials(name: string) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}


export default function SettingsView() {
    const {
        activeSettingsTab, setActiveSettingsTab,
        fetchTeamMembers,
        fetchCurrentUserProfile,
        language, setLanguage,
        notificationPrefs, setNotificationPref,
    } = useStore();
    const t = useT();

    // ── Profile state ────────────────────────────────────────────────────
    const [profileLoading, setProfileLoading] = useState(true);
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileId, setProfileId] = useState<string | null>(null);
    const [profileName, setProfileName] = useState('');
    const [profileRole, setProfileRole] = useState('');
    const [profileEmail, setProfileEmail] = useState('');

    // ── Password state ───────────────────────────────────────────────────
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [passwordError, setPasswordError] = useState('');

    // ── Avatar state ─────────────────────────────────────────────────────
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Test Notification state ───────────────────────────────────────
    const [testingNotif, setTestingNotif] = useState<string | null>(null);

    const handleTestNotif = async (type: 'assignment' | 'deadline' | 'missed' | 'owner' | 'posting') => {
        setTestingNotif(type);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) {
                toast.error('Kamu belum login');
                return;
            }
            const res = await fetch('/api/test-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: session.user.id, type }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('Test notifikasi terkirim! Cek 🔔 di atas.');
            } else {
                toast.error(data.error || 'Gagal mengirim test notifikasi');
            }
        } catch (err: any) {
            toast.error(err.message || 'Gagal mengirim test notifikasi');
        } finally {
            setTestingNotif(null);
        }
    };

    // Fetch profile from auth session + team_members
    const loadProfile = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.email) return;
            const email = session.user.email;
            setProfileEmail(email);

            const { data, error } = await supabase
                .from('team_members')
                .select('*')
                .eq('email', email)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') throw error;

            if (data) {
                setProfileId(data.id);
                setProfileName(data.name || '');
                setProfileRole(data.role || '');
                setAvatarUrl(data.avatar_url || null);
            } else {
                // No team_members row — use email prefix as placeholder
                setProfileId(null);
                setProfileName(email.split('@')[0]);
                setProfileRole('');
            }
        } catch (err) {
            console.error('Error loading profile:', err);
        } finally {
            setProfileLoading(false);
        }
    }, []);

    useEffect(() => { loadProfile(); }, [loadProfile]);

    // ── Avatar upload ────────────────────────────────────────────────────
    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate
        if (!file.type.startsWith('image/')) {
            toast.error(t.settings_select_image);
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            toast.error(t.settings_image_size);
            return;
        }

        setAvatarUploading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) throw new Error('Not authenticated');

            const userId = session.user.id;
            const ext = file.name.split('.').pop() || 'jpg';
            const filePath = `${userId}.${ext}`;

            // Upload (upsert) to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, { upsert: true, contentType: file.type });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
            const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`; // Cache bust

            // Save to team_members
            if (profileId) {
                const { error: dbError } = await supabase
                    .from('team_members')
                    .update({ avatar_url: publicUrl })
                    .eq('id', profileId);
                if (dbError) throw dbError;
            }

            setAvatarUrl(publicUrl);
            fetchCurrentUserProfile();
            toast.success(t.settings_photo_updated);
        } catch (err: any) {
            console.error('Avatar upload error:', err);
            toast.error(err.message || t.settings_photo_fail);
        } finally {
            setAvatarUploading(false);
            // Reset file input
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // ── Avatar delete ────────────────────────────────────────────────────
    const handleAvatarDelete = async () => {
        setAvatarUploading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) throw new Error('Not authenticated');

            const userId = session.user.id;

            // List files with this user's ID prefix and delete them
            const { data: files } = await supabase.storage.from('avatars').list('', {
                search: userId,
            });
            if (files && files.length > 0) {
                await supabase.storage.from('avatars').remove(files.map(f => f.name));
            }

            // Clear from DB
            if (profileId) {
                await supabase
                    .from('team_members')
                    .update({ avatar_url: null })
                    .eq('id', profileId);
            }

            setAvatarUrl(null);
            fetchCurrentUserProfile();
            toast.success(t.settings_photo_removed);
        } catch (err: any) {
            console.error('Avatar delete error:', err);
            toast.error(err.message || t.settings_photo_remove_fail);
        } finally {
            setAvatarUploading(false);
        }
    };

    // Save profile changes
    const handleSaveProfile = async () => {
        if (!profileName.trim()) { toast.error(t.settings_name_required); return; }
        setProfileSaving(true);
        try {
            if (profileId) {
                // Update existing row
                const { error } = await supabase
                    .from('team_members')
                    .update({ name: profileName.trim(), role: profileRole.trim() })
                    .eq('id', profileId);
                if (error) throw error;
            } else {
                // Create new row for this user
                const { data, error } = await supabase
                    .from('team_members')
                    .insert([{ name: profileName.trim(), email: profileEmail, role: profileRole.trim() }])
                    .select('*')
                    .single();
                if (error) throw error;
                if (data) setProfileId(data.id);
            }
            toast.success(t.settings_profile_saved);
            // Refresh team members and current user profile so sidebar/dropdowns stay in sync
            fetchTeamMembers();
            fetchCurrentUserProfile();
        } catch (err) {
            console.error('Error saving profile:', err);
            toast.error(t.settings_profile_fail);
        } finally {
            setProfileSaving(false);
        }
    };

    // Save password
    const handleSavePassword = async () => {
        setPasswordError('');
        if (!newPassword || !confirmPassword) {
            setPasswordError(t.settings_password_both);
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError(t.settings_password_mismatch);
            return;
        }
        if (newPassword.length < 6) {
            setPasswordError(t.settings_password_short);
            return;
        }

        setPasswordSaving(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            toast.success(t.settings_password_success);
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            console.error('Error updating password:', err);
            setPasswordError(err.message || 'Failed to update password');
            toast.error(t.settings_password_fail);
        } finally {
            setPasswordSaving(false);
        }
    };

    const tabs = [
        { id: 'profile' as const, label: t.settings_profile, icon: User },
        { id: 'appearance' as const, label: t.settings_appearance, icon: Palette },
        { id: 'notifications' as const, label: t.settings_notifications, icon: Bell },
    ];


    return (
        <div className="p-8 w-full">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-zinc-950 dark:text-white">{t.settings_title}</h1>
                <p className="text-zinc-500 dark:text-zinc-400 mt-1">{t.settings_subtitle}</p>
            </div>

            <div className="flex gap-6">
                {/* Vertical Tabs */}
                <div className="w-48 flex-shrink-0">
                    <nav className="space-y-0.5">
                        {tabs.map(({ id, label, icon: Icon }) => (
                            <button
                                key={id}
                                onClick={() => setActiveSettingsTab(id)}
                                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-left transition-all ${activeSettingsTab === id
                                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-white shadow-sm'
                                    : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5/50 hover:text-white/5 dark:hover:text-zinc-200/60'
                                    }`}
                            >
                                <Icon strokeWidth={1.5} className="w-4 h-4" />
                                {label}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {activeSettingsTab === 'profile' && (
                        <div className="w-full bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200/60 dark:border-white/5 shadow-sm p-6 space-y-6 transition-colors">
                            <h2 className="font-semibold text-zinc-950 dark:text-white">{t.settings_profile_title}</h2>

                            {profileLoading ? (
                                <div className="py-8 flex justify-center">
                                    <div className="w-6 h-6 border-2 border-zinc-900 dark:border-white border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : (
                                <>
                                    {/* Avatar + Name Preview */}
                                    <div className="flex items-center gap-5">
                                        {/* Interactive Avatar */}
                                        <div className="relative group">
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*"
                                                onChange={handleAvatarUpload}
                                                className="hidden"
                                            />

                                            {/* Avatar circle */}
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={avatarUploading}
                                                className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-zinc-200/60 dark:border-white/10 transition-all hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
                                            >
                                                {avatarUrl ? (
                                                    <img
                                                        src={avatarUrl}
                                                        alt="Profile"
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className={`w-full h-full bg-gradient-to-br ${getAvatarColor(profileName || 'U')} flex items-center justify-center text-white text-2xl font-bold`}>
                                                        {getInitials(profileName || 'U')}
                                                    </div>
                                                )}

                                                {/* Hover overlay */}
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    {avatarUploading ? (
                                                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                                                    ) : (
                                                        <Camera className="w-5 h-5 text-white" />
                                                    )}
                                                </div>
                                            </button>

                                            {/* Remove button (only if photo exists) */}
                                            {avatarUrl && !avatarUploading && (
                                                <button
                                                    type="button"
                                                    onClick={handleAvatarDelete}
                                                    className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
                                                    title={t.remove_photo}
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>

                                        <div>
                                            <p className="font-semibold text-zinc-950 dark:text-white">{profileName || t.settings_set_name}</p>
                                            <p className="text-sm text-zinc-500 dark:text-zinc-400">{profileRole || t.settings_set_role}</p>
                                            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                                                {avatarUrl ? t.settings_avatar_change : t.settings_avatar_upload}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Form Fields */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">{t.settings_full_name}</label>
                                            <input
                                                value={profileName}
                                                onChange={(e) => setProfileName(e.target.value)}
                                                placeholder="Your name"
                                                className="w-full text-sm bg-white dark:bg-zinc-950 text-zinc-950 dark:text-white border border-zinc-200/60 dark:border-white/5 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 focus:border-transparent transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">{t.settings_job_role}</label>
                                            <select
                                                value={profileRole}
                                                onChange={(e) => setProfileRole(e.target.value)}
                                                className="w-full text-sm bg-white dark:bg-zinc-950 text-zinc-950 dark:text-white border border-zinc-200/60 dark:border-white/5 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 focus:border-transparent transition-colors cursor-pointer"
                                            >
                                                <option value="" disabled>{t.settings_select_role}</option>
                                                <option value="Creative Director">Creative Director</option>
                                                <option value="Art Director">Art Director</option>
                                                <option value="Copywriter">Copywriter</option>
                                                <option value="Graphic Designer">Graphic Designer</option>
                                                <option value="Video Editor">Video Editor</option>
                                                <option value="Animator">Animator</option>
                                                <option value="Social Media Manager">Social Media Manager</option>
                                                <option value="Content Creator">Content Creator</option>
                                                <option value="Account Executive">Account Executive</option>
                                                <option value="Project Manager">Project Manager</option>
                                                <option value="Brand Manager">Brand Manager</option>
                                                <option value="Writer">Writer</option>
                                                <option value="Editor">Editor</option>
                                                <option value="Journalist">Journalist</option>
                                                <option value="Content Strategist">Content Strategist</option>
                                                <option value="SEO Specialist">SEO Specialist</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">{t.settings_email} <span className="text-zinc-400 dark:text-zinc-600 font-normal">{t.settings_read_only}</span></label>
                                            <input
                                                value={profileEmail}
                                                disabled
                                                className="w-full text-sm bg-zinc-50 dark:bg-white/5 text-zinc-500 dark:text-zinc-400 border border-zinc-200/60 dark:border-white/5 rounded-xl px-3 py-2 cursor-not-allowed"
                                            />
                                        </div>
                                    </div>



                                    {/* Save Button */}
                                    <button
                                        onClick={handleSaveProfile}
                                        disabled={profileSaving}
                                        className={`px-5 py-2 text-white text-sm font-semibold rounded-xl transition-all ${profileSaving ? 'bg-brand-400 cursor-wait' : 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:bg-white/5 dark:bg-zinc-100'}`}
                                    >
                                        {profileSaving ? t.settings_saving : t.settings_save}
                                    </button>

                                    {/* Password Change Section */}
                                    <div className="pt-8 border-t border-zinc-200/60 dark:border-white/5">
                                        <h3 className="font-semibold text-zinc-950 dark:text-white mb-4">{t.settings_security}</h3>
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">{t.settings_new_password}</label>
                                                    <input
                                                        type="password"
                                                        value={newPassword}
                                                        onChange={(e) => setNewPassword(e.target.value)}
                                                        placeholder={t.settings_password_placeholder}
                                                        className="w-full text-sm bg-white dark:bg-zinc-950 text-zinc-950 dark:text-white border border-zinc-200/60 dark:border-white/5 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 focus:border-transparent transition-colors"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">{t.settings_confirm_password}</label>
                                                    <input
                                                        type="password"
                                                        value={confirmPassword}
                                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                                        placeholder={t.settings_password_placeholder}
                                                        className="w-full text-sm bg-white dark:bg-zinc-950 text-zinc-950 dark:text-white border border-zinc-200/60 dark:border-white/5 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 focus:border-transparent transition-colors"
                                                    />
                                                </div>
                                            </div>

                                            {passwordError && (
                                                <p className="text-xs text-red-500 font-medium">{passwordError}</p>
                                            )}

                                            <div className="flex items-center gap-4">
                                                <button
                                                    onClick={handleSavePassword}
                                                    disabled={passwordSaving || !newPassword || !confirmPassword}
                                                    className={`px-5 py-2 text-white text-sm font-semibold rounded-xl transition-all ${passwordSaving ? 'bg-zinc-400 cursor-wait' : 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:bg-white/5 dark:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed'}`}
                                                >
                                                    {passwordSaving ? t.settings_updating : t.settings_update_password}
                                                </button>

                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            const { error } = await supabase.auth.resetPasswordForEmail(profileEmail, {
                                                                redirectTo: `${window.location.origin}/reset-password`,
                                                            });
                                                            if (error) throw error;
                                                            toast.success(t.settings_reset_sent);
                                                        } catch (err: any) {
                                                            const msg = err.message || '';
                                                            if (msg.includes('rate limit') || msg.includes('Error sending recovery email') || msg.includes('over the email rate limit')) {
                                                                toast.error(t.settings_reset_rate_limit);
                                                            } else {
                                                                toast.error(msg || t.settings_reset_fail);
                                                            }
                                                        }
                                                    }}
                                                    className="px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 rounded-xl transition-colors"
                                                >
                                                    {t.settings_send_reset}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}


                    {/* ── Appearance Tab ─────────────────────────────────────────── */}
                    {activeSettingsTab === 'appearance' && (
                        <div className="w-full bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200/60 dark:border-white/5 shadow-sm p-6 space-y-6 transition-colors">
                            <h2 className="font-semibold text-zinc-950 dark:text-white">{t.settings_appearance_title}</h2>
                            <div className="pt-2">
                                <h3 className="text-sm font-semibold text-text-main dark:text-gray-100 mb-4">{t.settings_theme}</h3>
                                <div className="flex items-center justify-between p-4 bg-background-light dark:bg-gray-800 rounded-xl border border-border-subtle dark:border-gray-700">
                                    <div>
                                        <p className="text-sm font-medium text-text-main dark:text-gray-100">{t.settings_color_mode}</p>
                                        <p className="text-xs text-text-muted dark:text-gray-400 mt-1">{t.settings_color_mode_desc}</p>
                                    </div>
                                    <ThemeToggle isSidebar={false} />
                                </div>
                            </div>

                            {/* Language Selector */}
                            <div className="pt-4">
                                <h3 className="text-sm font-semibold text-text-main dark:text-gray-100 mb-4">{t.settings_language}</h3>
                                <div className="flex items-center justify-between p-4 bg-background-light dark:bg-gray-800 rounded-xl border border-border-subtle dark:border-gray-700">
                                    <div>
                                        <p className="text-sm font-medium text-text-main dark:text-gray-100">{t.settings_language}</p>
                                        <p className="text-xs text-text-muted dark:text-gray-400 mt-1">{t.settings_language_desc}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setLanguage('id')}
                                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${language === 'id'
                                                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
                                                    : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5'
                                                }`}
                                        >
                                            🇮🇩 Indonesia
                                        </button>
                                        <button
                                            onClick={() => setLanguage('en')}
                                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${language === 'en'
                                                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
                                                    : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5'
                                                }`}
                                        >
                                            🇬🇧 English
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Notifications Tab ─────────────────────────────────────── */}
                    {activeSettingsTab === 'notifications' && (
                        <div className="w-full bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200/60 dark:border-white/5 shadow-sm p-6 space-y-6 transition-colors">
                            <div>
                                <h2 className="font-semibold text-zinc-950 dark:text-white">{t.settings_notifications}</h2>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{t.settings_notifications_desc}</p>
                            </div>

                            <div className="space-y-3">
                                {/* Assignment Notification */}
                                <div className="p-4 bg-background-light dark:bg-gray-800 rounded-xl border border-border-subtle dark:border-gray-700">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[20px]">assignment_ind</span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-text-main dark:text-gray-100">{t.notif_assignment_title}</p>
                                                <p className="text-xs text-text-muted dark:text-gray-400 mt-0.5">{t.notif_assignment_desc}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => handleTestNotif('assignment')}
                                                disabled={testingNotif === 'assignment'}
                                                className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
                                                title="Kirim Test Notifikasi"
                                            >
                                                <span className={`material-symbols-outlined text-[18px] ${testingNotif === 'assignment' ? 'animate-spin' : ''}`}>
                                                    {testingNotif === 'assignment' ? 'sync' : 'send'}
                                                </span>
                                            </button>
                                            <button
                                                onClick={() => setNotificationPref('assignment', !notificationPrefs.assignment)}
                                                className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30 flex-shrink-0 ${notificationPrefs.assignment ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-600'}`}
                                            >
                                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${notificationPrefs.assignment ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Deadline Reminder */}
                                <div className="p-4 bg-background-light dark:bg-gray-800 rounded-xl border border-border-subtle dark:border-gray-700">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-[20px]">schedule</span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-text-main dark:text-gray-100">{t.notif_deadline_title}</p>
                                                <p className="text-xs text-text-muted dark:text-gray-400 mt-0.5">{t.notif_deadline_desc}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => handleTestNotif('deadline')}
                                                disabled={testingNotif === 'deadline'}
                                                className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
                                                title="Kirim Test Notifikasi"
                                            >
                                                <span className={`material-symbols-outlined text-[18px] ${testingNotif === 'deadline' ? 'animate-spin' : ''}`}>
                                                    {testingNotif === 'deadline' ? 'sync' : 'send'}
                                                </span>
                                            </button>
                                            <button
                                                onClick={() => setNotificationPref('deadlineReminder', !notificationPrefs.deadlineReminder)}
                                                className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30 flex-shrink-0 ${notificationPrefs.deadlineReminder ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-600'}`}
                                            >
                                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${notificationPrefs.deadlineReminder ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Missed Share */}
                                <div className="p-4 bg-background-light dark:bg-gray-800 rounded-xl border border-border-subtle dark:border-gray-700">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-red-600 dark:text-red-400 text-[20px]">warning</span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-text-main dark:text-gray-100">{t.notif_missed_title}</p>
                                                <p className="text-xs text-text-muted dark:text-gray-400 mt-0.5">{t.notif_missed_desc}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => handleTestNotif('missed')}
                                                disabled={testingNotif === 'missed'}
                                                className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
                                                title="Kirim Test Notifikasi"
                                            >
                                                <span className={`material-symbols-outlined text-[18px] ${testingNotif === 'missed' ? 'animate-spin' : ''}`}>
                                                    {testingNotif === 'missed' ? 'sync' : 'send'}
                                                </span>
                                            </button>
                                            <button
                                                onClick={() => setNotificationPref('missedShare', !notificationPrefs.missedShare)}
                                                className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30 flex-shrink-0 ${notificationPrefs.missedShare ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-600'}`}
                                            >
                                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${notificationPrefs.missedShare ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Owner Report */}
                                <div className="p-4 bg-background-light dark:bg-gray-800 rounded-xl border border-border-subtle dark:border-gray-700">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-purple-600 dark:text-purple-400 text-[20px]">monitoring</span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-text-main dark:text-gray-100">{t.notif_owner_title}</p>
                                                <p className="text-xs text-text-muted dark:text-gray-400 mt-0.5">{t.notif_owner_desc}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => handleTestNotif('owner')}
                                                disabled={testingNotif === 'owner'}
                                                className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
                                                title="Kirim Test Notifikasi"
                                            >
                                                <span className={`material-symbols-outlined text-[18px] ${testingNotif === 'owner' ? 'animate-spin' : ''}`}>
                                                    {testingNotif === 'owner' ? 'sync' : 'send'}
                                                </span>
                                            </button>
                                            <button
                                                onClick={() => setNotificationPref('ownerReport', !notificationPrefs.ownerReport)}
                                                className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30 flex-shrink-0 ${notificationPrefs.ownerReport ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-600'}`}
                                            >
                                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${notificationPrefs.ownerReport ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Posting Reminder (Owner only) */}
                                <div className="p-4 bg-background-light dark:bg-gray-800 rounded-xl border border-border-subtle dark:border-gray-700">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-cyan-100 dark:bg-cyan-500/20 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-cyan-600 dark:text-cyan-400 text-[20px]">today</span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-text-main dark:text-gray-100">{t.notif_posting_title}</p>
                                                <p className="text-xs text-text-muted dark:text-gray-400 mt-0.5">{t.notif_posting_desc}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => handleTestNotif('posting')}
                                                disabled={testingNotif === 'posting'}
                                                className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
                                                title="Kirim Test Notifikasi"
                                            >
                                                <span className={`material-symbols-outlined text-[18px] ${testingNotif === 'posting' ? 'animate-spin' : ''}`}>
                                                    {testingNotif === 'posting' ? 'sync' : 'send'}
                                                </span>
                                            </button>
                                            <button
                                                onClick={() => setNotificationPref('postingReminder', !notificationPrefs.postingReminder)}
                                                className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30 flex-shrink-0 ${notificationPrefs.postingReminder ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-600'}`}
                                            >
                                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${notificationPrefs.postingReminder ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Info note */}
                            <div className="flex items-start gap-2.5 p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-100 dark:border-blue-500/20">
                                <span className="material-symbols-outlined text-blue-500 text-[18px] mt-0.5">info</span>
                                <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                                    {t.notif_info}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

