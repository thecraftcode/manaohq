'use client';

import { useStore } from '@/store/useStore';
import { useState, useEffect } from 'react';
import { ExternalLink, Plus, Rocket, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import PostDrawer from '../PostDrawer';
import { useT } from '@/lib/i18n';

export default function IdeaBankView() {
    const { rawIdeas, fetchRawIdeas, addRawIdea, deleteRawIdea, activeWorkspaceId } = useStore();
    const [ideaText, setIdeaText] = useState('');
    const [referenceUrl, setReferenceUrl] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const t = useT();

    // Controlled Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedIdea, setSelectedIdea] = useState<any>(null);

    useEffect(() => {
        // Fetch raw ideas on mount
        fetchRawIdeas();
    }, [fetchRawIdeas]);

    const handleAddIdea = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!ideaText.trim()) {
            toast.error(t.idea_name_required);
            return;
        }

        setIsSubmitting(true);
        try {
            await addRawIdea(ideaText, referenceUrl);
            setIdeaText('');
            setReferenceUrl('');
            toast.success(t.idea_success);
        } catch (error) {
            toast.error(t.idea_fail);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpgrade = (idea: any) => {
        setSelectedIdea(idea);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm(t.idea_delete_confirm)) {
            await deleteRawIdea(id);
            toast.success(t.idea_deleted);
        }
    };

    if (!activeWorkspaceId) {
        return (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
                <div className="w-20 h-20 bg-primary/10 dark:bg-primary/20 rounded-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-4xl">workspaces</span>
                </div>
                <h2 className="text-xl font-bold text-text-main dark:text-gray-100">{t.dash_no_workspace}</h2>
                <p className="text-text-muted text-sm max-w-sm text-center">{t.dash_no_workspace_desc}</p>
            </div>
        );
    }

    return (
        <div className="w-full flex-1">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-text-main dark:text-gray-100 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#f59e0b] text-3xl">lightbulb</span>
                    {t.idea_title}
                </h1>
                <p className="text-text-muted mt-1.5 font-medium">
                    {t.idea_subtitle}
                </p>
            </div>

            {/* Input Form Section */}
            <div className="bg-surface-white dark:bg-gray-900 rounded-2xl border border-border-subtle p-6 mb-8 shadow-sm">
                <form onSubmit={handleAddIdea} className="flex flex-col md:flex-row gap-4 items-start md:items-end">
                    <div className="flex-1 w-full">
                        <label className="block text-xs font-semibold text-text-muted mb-1.5">
                            {t.idea_name_label} <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={ideaText}
                            onChange={(e) => setIdeaText(e.target.value)}
                            placeholder={t.idea_name_placeholder}
                            className="w-full text-sm border border-border-subtle dark:border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background-light dark:bg-gray-800 text-text-main dark:text-white transition-colors"
                        />
                    </div>
                    <div className="flex-1 w-full">
                        <label className="block text-xs font-semibold text-text-muted mb-1.5">
                            {t.idea_ref_label}
                        </label>
                        <input
                            type="text"
                            value={referenceUrl}
                            onChange={(e) => setReferenceUrl(e.target.value)}
                            placeholder="https://tiktok.com/@..."
                            className="w-full text-sm border border-border-subtle dark:border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background-light dark:bg-gray-800 text-text-main dark:text-white transition-colors"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isSubmitting || !ideaText.trim()}
                        className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-xl shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Plus className="w-4 h-4" />
                        {t.idea_save}
                    </button>
                </form>
            </div>

            {/* List Section */}
            <div className="bg-surface-white dark:bg-gray-900 rounded-2xl border border-border-subtle overflow-hidden shadow-sm">
                {rawIdeas.length === 0 ? (
                    <div className="py-16 text-center">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-gray-400 text-3xl">inbox</span>
                        </div>
                        <h3 className="text-gray-900 dark:text-gray-200 font-semibold mb-1">{t.idea_empty}</h3>
                        <p className="text-gray-500 text-sm">{t.idea_empty_desc}</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-border-subtle/50 dark:divide-gray-800">
                        {rawIdeas.map((idea) => (
                            <li key={idea.id} className="p-4 hover:bg-[#f9fafb] dark:hover:bg-gray-800/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 group">
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-text-main dark:text-gray-100 font-semibold text-base mb-1 truncate">
                                        {idea.idea_text}
                                    </h4>
                                    {idea.reference_url && (
                                        <a
                                            href={idea.reference_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-primary hover:underline flex items-center gap-1 w-max"
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                            {t.idea_view_ref}
                                        </a>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleUpgrade(idea)}
                                        className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-lg border border-emerald-200 dark:border-emerald-500/30 transition-colors"
                                    >
                                        <Rocket className="w-3.5 h-3.5" />
                                        {t.idea_add_calendar}
                                    </button>
                                    <button
                                        onClick={() => handleDelete(idea.id)}
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                        title="Delete Idea"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Post Drawer for Calendar Upgrades (Controlled Locally) */}
            <PostDrawer
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedIdea(null);
                }}
                initialIdeaText={selectedIdea?.idea_text || ''}
                initialReferenceUrl={selectedIdea?.reference_url || ''}
                promotedFromIdeaId={selectedIdea?.id}
            />
        </div>
    );
}
