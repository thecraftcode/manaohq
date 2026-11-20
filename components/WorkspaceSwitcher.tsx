'use client';

import { useStore } from '@/store/useStore';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Plus, X, Building2, Check, Loader2, Settings } from 'lucide-react';
import { toast } from 'sonner';
import WorkspaceSettingsModal from './WorkspaceSettingsModal';
import { useT } from '@/lib/i18n';

export default function WorkspaceSwitcher() {
    const { workspaces, activeWorkspaceId, activeRole, setActiveWorkspace, createWorkspace, showWorkspaceSettings, setShowWorkspaceSettings } = useStore();
    const [isOpen, setIsOpen] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [newName, setNewName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
    const t = useT();

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setIsCreating(true);
        try {
            await createWorkspace(newName.trim());
            setNewName('');
            setShowModal(false);
            setIsOpen(false);
            toast.success(t.ws_created + ' 🎉');
        } catch {
            toast.error(t.ws_create_fail);
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <>
            <div className="relative" ref={dropdownRef}>
                {/* Trigger row */}
                <div className="flex items-center">
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[#f5f7fa] dark:hover:bg-gray-800 transition-all text-left group overflow-hidden"
                    >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-white shadow-sm flex-shrink-0">
                            <Building2 className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-text-main dark:text-gray-100 truncate">
                                {activeWorkspace?.name || t.ws_select}
                            </p>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-text-muted font-medium">{t.ws_label}</span>
                                {(activeWorkspaceId && ['owner', 'admin'].includes(activeRole?.toLowerCase() || '')) && (
                                    <span
                                        onClick={(e) => { e.stopPropagation(); setShowWorkspaceSettings(true); setIsOpen(false); }}
                                        className="text-[10px] text-primary font-bold cursor-pointer hover:underline"
                                    >
                                        · {t.ws_manage}
                                    </span>
                                )}
                            </div>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-text-muted transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                {/* Dropdown */}
                {isOpen && (
                    <div className="absolute left-2 right-2 top-full mt-1 bg-surface-white dark:bg-gray-800 border border-border-subtle rounded-xl shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="py-1 max-h-[200px] overflow-y-auto">
                            {workspaces.length === 0 && (
                                <p className="px-4 py-3 text-sm text-text-muted text-center">{t.ws_no_workspaces}</p>
                            )}
                            {workspaces.map((ws) => (
                                <button
                                    key={ws.id}
                                    onClick={() => {
                                        setActiveWorkspace(ws.id);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${ws.id === activeWorkspaceId
                                        ? 'bg-[#e6f0f5] dark:bg-primary/20 text-primary font-bold'
                                        : 'text-text-main dark:text-gray-200 hover:bg-background-light dark:hover:bg-gray-700/50 font-medium'
                                        }`}
                                >
                                    <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold ${ws.id === activeWorkspaceId
                                        ? 'bg-primary text-white'
                                        : 'bg-gray-100 dark:bg-gray-700 text-text-muted dark:text-gray-400'
                                        }`}>
                                        {ws.name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="flex-1 text-left truncate">{ws.name}</span>
                                    {ws.id === activeWorkspaceId && (
                                        <Check className="w-4 h-4 text-primary flex-shrink-0" />
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Create New */}
                        <div className="border-t border-border-subtle/50 dark:border-gray-700">
                            <button
                                onClick={() => {
                                    setShowModal(true);
                                    setIsOpen(false);
                                }}
                                className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-bold text-primary hover:bg-[#e6f0f5] dark:hover:bg-primary/10 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                {t.ws_create_new}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Create Workspace Modal — rendered via portal to escape sidebar transform */}
            {showModal && createPortal(
                <>
                    <div
                        className="fixed inset-0 z-[60] bg-gray-900/40 backdrop-blur-sm"
                        onClick={() => setShowModal(false)}
                    />
                    <div className="fixed inset-0 z-[61] flex items-center justify-center p-4">
                        <div className="bg-surface-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-border-subtle w-full max-w-md overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle/30 dark:border-gray-800">
                                <div>
                                    <h3 className="font-bold text-text-main dark:text-white text-lg">{t.ws_new}</h3>
                                    <p className="text-xs text-text-muted mt-0.5">{t.ws_new_desc}</p>
                                </div>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="p-1.5 rounded-lg hover:bg-background-light dark:hover:bg-gray-800 text-text-muted hover:text-text-main transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Body */}
                            <form onSubmit={handleCreate} className="px-6 py-5">
                                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                                    {t.ws_name_required} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder={t.ws_name_placeholder}
                                    autoFocus
                                    className="w-full text-sm border border-border-subtle dark:border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background-light dark:bg-gray-800 text-text-main dark:text-white transition-colors"
                                />
                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="px-4 py-2 text-sm text-text-muted hover:text-text-main font-medium rounded-xl hover:bg-background-light dark:hover:bg-gray-800 transition-colors"
                                    >
                                        {t.cancel}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!newName.trim() || isCreating}
                                        className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isCreating ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                {t.ws_creating}
                                            </>
                                        ) : (
                                            <>
                                                <Plus className="w-4 h-4" />
                                                {t.ws_create}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </>
                , document.body)}

            {/* Workspace Settings Modal */}
            <WorkspaceSettingsModal isOpen={showWorkspaceSettings} onClose={() => setShowWorkspaceSettings(false)} />
        </>
    );
}
