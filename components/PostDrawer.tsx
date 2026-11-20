'use client';

import { useStore, Post, StatusType } from '@/store/useStore';
import {
    X,
    Maximize2,
    Minimize2,
    Link2,
    ExternalLink,
    Save,
    FileText,
    CheckCircle2,
    Sparkles,
    Loader2,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { StatusBadge } from './Badges';
import Editor from './Editor';
import TaskPresence from './TaskPresence';
import { useT } from '@/lib/i18n';



/** Empty form defaults — used for "New Post" and after every save. */
const emptyForm = (): Partial<Post> => ({
    idea: '',
    pillar: '',
    funnel: '',
    type: '',
    deadline: '',
    postDate: '',
    status: 'Draft',
    assetLink: '',
    publishedLink: '',
    script: '',
    hook: '',
    caption: '',
    pic: '',
    thumbnailUrl: '',
    referenceUrl: '',
});

interface PostDrawerProps {
    isOpen?: boolean;
    onClose?: () => void;
    initialIdeaText?: string;
    initialReferenceUrl?: string;
    promotedFromIdeaId?: string;
}

export default function PostDrawer({
    isOpen: controlledIsOpen,
    onClose: controlledOnClose,
    initialIdeaText,
    initialReferenceUrl,
    promotedFromIdeaId
}: PostDrawerProps = {}) {
    const {
        drawerOpen, drawerPost, drawerPrefill, closeDrawer,
        focusMode, toggleFocusMode,
        updatePost, addPost, deleteRawIdea, pillars, funnels, contentTypes, statuses,
        teamMembers, activeRole
    } = useStore();

    const isMember = activeRole === 'member';
    const tr = useT();

    // Use controlled props if provided, otherwise fall back to global store
    const isModeControlled = controlledIsOpen !== undefined;
    const isDrawerActive = isModeControlled ? controlledIsOpen : drawerOpen;

    const isNew = !drawerPost;
    const [form, setForm] = useState<Partial<Post>>(emptyForm());
    const [saved, setSaved] = useState(false);   // flash-feedback state
    const [isSaving, setIsSaving] = useState(false); // prevent double-click
    const [titleError, setTitleError] = useState(false);
    const [deadlineError, setDeadlineError] = useState(false);
    const [dateError, setDateError] = useState(false);
    const [isFetchingCaption, setIsFetchingCaption] = useState(false);

    const handleClose = () => {
        if (isModeControlled && controlledOnClose) {
            controlledOnClose();
        } else {
            closeDrawer();
        }
    };

    // Populate form when the drawer opens (edit mode) or reset it (new mode)
    useEffect(() => {
        if (!isDrawerActive) return;
        setTitleError(false);
        setDeadlineError(false);
        setDateError(false);
        setSaved(false);

        if (drawerPost && !isModeControlled) {
            setForm({ ...drawerPost });
        } else if (drawerPrefill && !isModeControlled) {
            setForm({ ...emptyForm(), idea: drawerPrefill.idea, referenceUrl: drawerPrefill.assetLink }); // Historically assetLink was passed, but IdeaBank view mapping will change
        } else if (isModeControlled && (initialIdeaText || initialReferenceUrl)) {
            setForm({ ...emptyForm(), idea: initialIdeaText || '', referenceUrl: initialReferenceUrl || '' });
        } else {
            setForm(emptyForm());
        }
    }, [isDrawerActive, drawerPost, drawerPrefill, isModeControlled, initialIdeaText, initialReferenceUrl]);

    // Handle Browser Back Button for Focus Mode
    useEffect(() => {
        if (!focusMode) return;

        // Push state to prevent browser from instantly navigating away
        window.history.pushState({ isFocusMode: true }, '');

        const handlePopState = () => {
            // User clicked browser back button
            // If they were in focusMode, just close the drawer
            closeDrawer();
        };

        window.addEventListener('popstate', handlePopState);
        
        return () => {
            window.removeEventListener('popstate', handlePopState);
            // If we are exiting focus mode programmatically, pop the state we pushed
            if (window.history.state?.isFocusMode) {
                window.history.back();
            }
        };
    }, [focusMode, closeDrawer]);

    if (!isDrawerActive) return null;

    const upd = (field: keyof Post) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
            if (field === 'idea') setTitleError(false);
            if (field === 'deadline') setDeadlineError(false);
            if (field === 'postDate') setDateError(false);
            setForm((prev) => ({ ...prev, [field]: e.target.value }));
        };

    const handleFetchCaption = async (e: React.FocusEvent<HTMLInputElement>) => {
        const igUrl = e.target.value;
        console.log("Sensor Triggered! Link:", igUrl);

        // Relaxed validation: only check if it includes instagram.com and caption is empty
        if (!igUrl || !igUrl.includes('instagram.com') || form.caption?.trim()) {
            return;
        }

        setIsFetchingCaption(true);
        try {
            const res = await fetch('/api/fetch-ig', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: igUrl }),
            });

            if (!res.ok) {
                throw new Error('Failed to fetch caption');
            }

            const data = await res.json();
            if (data.caption || data.thumbnailUrl) {
                setForm(prev => ({
                    ...prev,
                    caption: data.caption || prev.caption,
                    thumbnailUrl: data.thumbnailUrl || prev.thumbnailUrl
                }));
                toast.success('Auto-filled successfully!');
            } else {
                toast.error('Could not extract caption from this link.');
            }
        } catch (error) {
            console.error("Fetch Error:", error);
            toast.error('Error fetching caption. Ensure URL is public.');
        } finally {
            setIsFetchingCaption(false);
        }
    };

    /** Build a fully-typed Post object and push it to the Zustand store */
    const handleSave = async () => {
        // ── Validation ──────────────────────────────────────────────────────
        let hasError = false;
        if (!form.idea?.trim()) {
            setTitleError(true);
            hasError = true;
        }
        if (isNew) {
            if (!form.deadline?.trim()) {
                setDeadlineError(true);
                hasError = true;
            }
            if (!form.postDate?.trim()) {
                setDateError(true);
                hasError = true;
            }
        }

        if (hasError) return;

        // Prevent double-click
        if (isSaving) return;
        setIsSaving(true);

        // ── Persist ─────────────────────────────────────────────────────────
        try {
            if (isNew) {
                const newPost: Post = {
                    id: '',                                  // Supabase auto-generates UUID
                    idea: form.idea!.trim(),
                    pillar: form.pillar ?? '',
                    funnel: form.funnel ?? '',
                    type: form.type ?? '',
                    deadline: form.deadline!,
                    postDate: form.postDate!,
                    status: form.status ?? 'Idea',
                    assetLink: form.assetLink ?? '',
                    publishedLink: form.publishedLink ?? '',
                    script: form.script ?? '',
                    hook: form.hook ?? '',
                    caption: form.caption ?? '',
                    pic: form.pic ?? '',
                    thumbnailUrl: form.thumbnailUrl ?? '',
                    referenceUrl: form.referenceUrl ?? '',
                };
                await addPost(newPost);
                // If it was upgraded from the Idea Bank globally (drawerPrefill)
                if (!isModeControlled && drawerPrefill) {
                    deleteRawIdea(drawerPrefill.id);
                }
                // If it was upgraded visually via local props in IdeaBankView
                else if (isModeControlled && promotedFromIdeaId) {
                    deleteRawIdea(promotedFromIdeaId);
                }
                toast.success('Post created successfully!');
            } else {
                await updatePost({ ...(drawerPost!), ...form } as Post);
                toast.success('Post updated successfully!');
            }

            // ── Flash feedback → then close ──────────────────────────────────────
            setSaved(true);
            setTimeout(() => {
                setSaved(false);
                setIsSaving(false);
                handleClose();      // resets drawerPost & focusMode in store OR triggers prop close
            }, 600);
        } catch (err: any) {
            console.error('Error saving post in drawer:', err);
            toast.error(err?.message || 'Gagal menyimpan post');
            setIsSaving(false);
        }
    };

    // Focus mode: fullscreen
    if (focusMode) {
        return (
            <div className="fixed inset-0 z-[100] bg-surface-white dark:bg-background-dark flex flex-col transition-colors">
                {/* Focus Mode Header */}
                <div className="flex items-center justify-between px-8 py-4 border-b border-border-subtle/40 dark:border-gray-800 bg-surface-white dark:bg-background-dark transition-colors">
                    <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-primary" />
                        <span className="text-text-main dark:text-gray-100 font-semibold transition-colors">{form.idea || tr.drawer_untitled}</span>
                        {form.status && <StatusBadge status={form.status as StatusType} />}
                        {!isNew && drawerPost?.id && <TaskPresence taskId={drawerPost.id} />}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleFocusMode}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#e6f0f5] dark:bg-gray-800 text-text-muted dark:text-gray-300 hover:bg-primary/20 dark:hover:bg-gray-700 text-xs font-medium transition-colors"
                        >
                            <Minimize2 className="w-3.5 h-3.5" />
                            {tr.drawer_exit_focus}
                        </button>
                        {!isMember && (
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save className="w-3.5 h-3.5" />
                                {tr.drawer_save}
                            </button>
                        )}
                    </div>
                </div>
                {/* Scrollable Container */}
                <div className="flex-1 overflow-y-auto">
                    <div className="flex flex-col px-8 py-10 max-w-5xl mx-auto w-full min-h-full">
                        <input
                            value={form.idea ?? ''}
                            onChange={upd('idea')}
                            placeholder={isMember ? '' : tr.drawer_title_placeholder}
                            readOnly={isMember}
                            className="bg-transparent text-text-main dark:text-white text-3xl md:text-4xl font-bold outline-none placeholder-gray-400 dark:placeholder-gray-600 mb-8 border-none transition-colors"
                        />
                        <div className="w-full relative">

                            <Editor
                                value={form.script ?? ''}
                                onChange={(val) => setForm(prev => ({ ...prev, script: val }))}
                                placeholder={isMember ? '' : tr.drawer_script_placeholder}
                                readOnly={isMember}
                            />
                        </div>
                        <p className="text-slate-500 dark:text-slate-500 text-xs mt-8 pb-10 text-right">
                            {(form.script ?? '').replace(/<[^>]*>?/gm, '').split(/\s+/).filter(Boolean).length} {tr.drawer_words}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Normal drawer
    return (
        <>
            {/* Backdrop */}
            <div
                onClick={handleClose}
                className="fixed inset-0 z-40 bg-gray-900/30 backdrop-blur-sm"
            />

            {/* Drawer */}
            <div className="fixed inset-x-0 bottom-0 md:left-auto md:right-0 md:top-0 z-50 w-full h-[95vh] md:h-full md:w-[480px] bg-surface-white dark:bg-gray-900 shadow-[0_-8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_-8px_30px_rgb(0,0,0,0.3)] md:shadow-2xl flex flex-col rounded-t-3xl md:rounded-none overflow-hidden transition-all duration-300">
                {/* Header flex-shrink-0 to prevent squishing */}
                <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-border-subtle/30 dark:border-gray-800 bg-surface-white dark:bg-gray-900 transition-colors">
                    <div className="flex items-center gap-3">
                        <div>
                            <h2 className="font-semibold text-text-main dark:text-white">{isNew ? tr.drawer_new_post : tr.drawer_edit_post}</h2>
                            <p className="text-xs text-text-muted mt-0.5">
                                {isNew ? tr.drawer_create_new : tr.drawer_update_details}
                            </p>
                        </div>
                        {!isNew && drawerPost?.id && <TaskPresence taskId={drawerPost.id} />}
                    </div>
                    <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-[#e6f0f5] dark:hover:bg-gray-800 text-text-muted hover:text-text-main dark:hover:text-primary transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    {/* Title */}
                    <div>
                        <label className="block text-xs font-semibold text-text-muted mb-1.5">
                            {tr.drawer_post_title}
                            {isNew && <span className="text-red-500 ml-0.5">*</span>}
                        </label>
                        <input
                            value={form.idea ?? ''}
                            onChange={upd('idea')}
                            placeholder={tr.drawer_enter_idea}
                            className={`w-full text-sm border rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:border-transparent transition-colors ${titleError
                                ? 'border-red-400 focus:ring-red-300 bg-red-50 dark:bg-red-500/10 dark:border-red-500/50'
                                : 'border-border-subtle dark:border-gray-700 bg-surface-white dark:bg-gray-900 text-text-main dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-primary/50'
                                }`}
                        />
                        {titleError && (
                            <p className="text-xs text-red-500 dark:text-red-400 mt-1 flex items-center gap-1">
                                <span>{tr.drawer_title_required}</span>
                            </p>
                        )}
                    </div>

                    {/* Grid fields */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-text-muted mb-1.5">{tr.drawer_pillar}</label>
                            <select
                                value={form.pillar ?? ''}
                                onChange={upd('pillar')}
                                className="w-full text-sm border border-border-subtle dark:border-gray-700 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 bg-surface-white dark:bg-gray-900 text-text-main dark:text-white transition-colors"
                            >
                                <option value="" disabled hidden>{tr.drawer_select}</option>
                                {pillars.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-text-muted mb-1.5">{tr.drawer_status}</label>
                            <select
                                value={form.status ?? ''}
                                onChange={upd('status')}
                                className="w-full text-sm border border-border-subtle dark:border-gray-700 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 bg-surface-white dark:bg-gray-900 text-text-main dark:text-white capitalize transition-colors"
                            >
                                <option value="" disabled hidden>{tr.drawer_select}</option>
                                {statuses.map((s) => <option key={s.id} value={s.name} className="capitalize">{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-text-muted mb-1.5">{tr.drawer_funnel}</label>
                            <select
                                value={form.funnel ?? ''}
                                onChange={upd('funnel')}
                                className="w-full text-sm border border-border-subtle dark:border-gray-700 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 bg-surface-white dark:bg-gray-900 text-text-main dark:text-white transition-colors"
                            >
                                <option value="" disabled hidden>{tr.drawer_select}</option>
                                {funnels.map((f) => <option key={f.id} value={f.name}>{f.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-text-muted mb-1.5">{tr.drawer_type}</label>
                            <select
                                value={form.type ?? ''}
                                onChange={upd('type')}
                                className="w-full text-sm border border-border-subtle dark:border-gray-700 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 bg-surface-white dark:bg-gray-900 text-text-main dark:text-white transition-colors"
                            >
                                <option value="" disabled hidden>{tr.drawer_select}</option>
                                {contentTypes.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-text-muted mb-1.5">{tr.drawer_pic}</label>
                            <select
                                value={form.pic ?? ''}
                                onChange={upd('pic')}
                                className="w-full text-sm border border-border-subtle dark:border-gray-700 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 bg-surface-white dark:bg-gray-900 text-text-main dark:text-white transition-colors"
                            >
                                <option value="">{tr.drawer_unassigned}</option>
                                {teamMembers.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-text-muted mb-1.5">
                                {tr.drawer_deadline}
                                {isNew && <span className="text-red-500 ml-0.5">*</span>}
                            </label>
                            <input
                                type="date"
                                value={form.deadline ?? ''}
                                onChange={upd('deadline')}
                                className={`w-full text-sm border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:border-transparent transition-colors ${deadlineError
                                    ? 'border-red-400 focus:ring-red-300 bg-red-50 dark:bg-red-500/10 dark:border-red-500/50'
                                    : 'border-border-subtle dark:border-gray-700 bg-surface-white dark:bg-gray-900 text-text-main dark:text-white dark:placeholder-gray-500 focus:ring-primary/50'
                                    }`}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-text-muted mb-1.5">
                                {tr.drawer_post_date}
                                {isNew && <span className="text-red-500 ml-0.5">*</span>}
                            </label>
                            <input
                                type="date"
                                value={form.postDate ?? ''}
                                onChange={upd('postDate')}
                                className={`w-full text-sm border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:border-transparent transition-colors ${dateError
                                    ? 'border-red-400 focus:ring-red-300 bg-red-50 dark:bg-red-500/10 dark:border-red-500/50'
                                    : 'border-border-subtle dark:border-gray-700 bg-surface-white dark:bg-gray-900 text-text-main dark:text-white dark:placeholder-gray-500 focus:ring-primary/50'
                                    }`}
                            />
                        </div>
                    </div>

                    {/* Reference URL */}
                    <div>
                        <label className="block text-xs font-semibold text-text-muted mb-1.5">
                            <span className="flex items-center gap-1.5"><ExternalLink className="w-3 h-3 text-[#f59e0b]" /> {tr.drawer_reference}</span>
                        </label>
                        <input
                            value={form.referenceUrl ?? ''}
                            onChange={upd('referenceUrl')}
                            placeholder="https://tiktok.com/@..."
                            className="w-full text-sm border border-border-subtle dark:border-gray-700 bg-surface-white dark:bg-gray-900 text-text-main dark:text-white rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                        />
                    </div>

                    {/* Asset URL */}
                    <div>
                        <label className="block text-xs font-semibold text-text-muted mb-1.5">
                            <span className="flex items-center gap-1.5"><Link2 className="w-3 h-3" /> {tr.drawer_asset}</span>
                        </label>
                        <input
                            value={form.assetLink ?? ''}
                            onChange={upd('assetLink')}
                            placeholder="https://drive.google.com/..."
                            className="w-full text-sm border border-border-subtle dark:border-gray-700 bg-surface-white dark:bg-gray-900 text-text-main dark:text-white rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                        />
                    </div>

                    {/* Published URL (IG Link) */}
                    <div>
                        <label className="block text-xs font-semibold text-text-muted mb-1.5">
                            <span className="flex items-center gap-1.5"><ExternalLink className="w-3 h-3" /> {tr.drawer_link}</span>
                        </label>
                        <input
                            value={form.publishedLink ?? ''}
                            onChange={upd('publishedLink')}
                            onBlur={handleFetchCaption}
                            placeholder="https://instagram.com/p/..."
                            className="w-full text-sm border border-border-subtle dark:border-gray-700 bg-surface-white dark:bg-gray-900 text-text-main dark:text-white rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                        />
                    </div>

                    {/* Caption */}
                    <div className="relative">
                        <label className="block text-xs font-semibold text-text-muted mb-1.5">{tr.drawer_caption}</label>
                        <textarea
                            value={form.caption ?? ''}
                            onChange={upd('caption')}
                            placeholder={isFetchingCaption ? tr.drawer_fetching : tr.drawer_caption_placeholder}
                            disabled={isFetchingCaption}
                            rows={3}
                            className={`w-full text-sm border rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors resize-y ${isFetchingCaption
                                ? 'bg-background-light dark:bg-gray-800 border-primary/30 text-primary dark:text-primary placeholder-primary/60 dark:placeholder-primary/60 animate-pulse cursor-wait'
                                : 'border-border-subtle dark:border-gray-700 bg-surface-white dark:bg-gray-900 text-text-main dark:text-white placeholder-gray-400 dark:placeholder-gray-500'
                                }`}
                        />
                    </div>

                    {/* Script Editor */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold text-text-muted">{tr.drawer_script}</label>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={toggleFocusMode}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#e6f0f5] dark:bg-gray-800 hover:bg-primary/20 dark:hover:bg-gray-700 text-text-muted hover:text-primary text-xs font-medium transition-all"
                                >
                                    <Maximize2 className="w-3 h-3" />
                                    {tr.drawer_focus_mode}
                                </button>
                            </div>
                        </div>
                        <div className="relative mt-2">
                            <Editor
                                value={form.script ?? ''}
                                onChange={(val) => setForm(prev => ({ ...prev, script: val }))}
                                placeholder={tr.drawer_write_script}
                                className="min-h-[200px]"
                                showTable={false}
                            />
                            <p className="text-[10px] text-text-muted text-right mt-2 mb-1">
                                {(form.script ?? '').replace(/<[^>]*>?/gm, '').split(/\s+/).filter(Boolean).length}w
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border-subtle/30 dark:border-gray-800 flex items-center justify-between bg-surface-white dark:bg-gray-900 transition-colors">
                    <button
                        onClick={handleClose}
                        disabled={saved}
                        className="px-4 py-2 text-sm text-text-muted hover:text-text-main dark:hover:text-primary font-medium rounded-xl hover:bg-[#e6f0f5] dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
                    >
                        {tr.drawer_discard}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saved || isSaving}
                        className={`flex items-center gap-2 px-5 py-2 text-white text-sm font-semibold rounded-xl shadow-sm transition-all ${saved
                            ? 'bg-emerald-500 shadow-md cursor-default'
                            : 'bg-primary hover:bg-primary-hover shadow-sm'
                            }`}
                    >
                        {saved ? (
                            <>
                                <CheckCircle2 className="w-4 h-4" />
                                {tr.drawer_saved}
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                {isNew ? tr.drawer_create_post : tr.drawer_save_changes}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </>
    );
}
