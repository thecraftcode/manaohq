'use client';

import { useStore, TagDef } from '@/store/useStore';
import { Tag, Plus, X, ArrowLeft, GripVertical, Pencil, Check } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';

const availableColors = [
    '#6366f1', '#10b981', '#f59e0b', '#f43f5e',
    '#0ea5e9', '#8b5cf6', '#d946ef', '#64748b',
    '#0f766e', '#b91c1c', '#d97706', '#4338ca',
    '#22c55e', '#3b82f6', '#e11d48', '#7c3aed',
];

type TagCategory = 'pillar' | 'funnel' | 'contentType' | 'status';

function TagSection({ title, category, items, onAdd, onDelete, onUpdate, onReorder, t }: {
    title: string;
    category: TagCategory;
    items: TagDef[];
    onAdd: (n: string, c: string) => void;
    onDelete: (id: string) => void;
    onUpdate: (id: string, name: string, color: string, category: TagCategory) => void;
    onReorder: (category: TagCategory, items: TagDef[]) => void;
    t: Record<string, string>;
}) {
    const [newName, setNewName] = useState('');
    const [selectedColor, setSelectedColor] = useState(availableColors[0]);
    const [customColor, setCustomColor] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('');
    const [editCustomColor, setEditCustomColor] = useState('');
    const editRef = useRef<HTMLInputElement>(null);

    // Drag state
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    const handleAdd = () => {
        if (newName.trim()) {
            onAdd(newName.trim(), customColor || selectedColor);
            setNewName('');
            toast.success(`${title} ${t.tags_added}`);
        }
    };

    const startEdit = (item: TagDef) => {
        setEditingId(item.id);
        setEditName(item.name);
        setEditColor(item.color);
        setEditCustomColor('');
        setTimeout(() => editRef.current?.focus(), 50);
    };

    const saveEdit = () => {
        if (editingId && editName.trim()) {
            const finalColor = editCustomColor || editColor;
            onUpdate(editingId, editName.trim(), finalColor, category);
            toast.success(t.tags_updated || 'Tag updated');
        }
        setEditingId(null);
    };

    const cancelEdit = () => {
        setEditingId(null);
    };

    // Drag handlers
    const handleDragStart = (idx: number) => {
        setDragIndex(idx);
    };

    const handleDragOver = (e: React.DragEvent, idx: number) => {
        e.preventDefault();
        setDragOverIndex(idx);
    };

    const handleDragEnd = () => {
        if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
            const reordered = [...items];
            const [moved] = reordered.splice(dragIndex, 1);
            reordered.splice(dragOverIndex, 0, moved);
            onReorder(category, reordered);
            toast.success(t.tags_reordered || 'Order updated');
        }
        setDragIndex(null);
        setDragOverIndex(null);
    };

    const activeColor = customColor || selectedColor;

    return (
        <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200/60 dark:border-white/5 shadow-sm p-5 transition-colors w-full">
            <h3 className="font-semibold text-zinc-950 dark:text-white text-sm mb-4">{title}</h3>

            {/* Tag List — draggable */}
            <div className="flex flex-col gap-1.5 mb-4">
                {items.map((item, idx) => (
                    <div
                        key={item.id}
                        draggable={editingId !== item.id}
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDragEnd={handleDragEnd}
                        className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-all
                            ${dragOverIndex === idx && dragIndex !== idx ? 'border-t-2 border-primary' : 'border-t-2 border-transparent'}
                            ${dragIndex === idx ? 'opacity-40' : ''}
                            ${editingId === item.id ? 'bg-zinc-50 dark:bg-zinc-900 ring-1 ring-primary/20' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/50'}
                        `}
                    >
                        {/* Grip handle */}
                        <div className="cursor-grab active:cursor-grabbing text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 flex-shrink-0">
                            <GripVertical className="w-3.5 h-3.5" />
                        </div>

                        {editingId === item.id ? (
                            /* Edit mode */
                            <div className="flex-1 flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <input
                                        ref={editRef}
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') saveEdit();
                                            if (e.key === 'Escape') cancelEdit();
                                        }}
                                        className="flex-1 text-xs bg-white dark:bg-zinc-950 text-zinc-950 dark:text-white border border-zinc-200/60 dark:border-white/10 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    />
                                    <button
                                        onClick={saveEdit}
                                        className="p-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                        title="Save"
                                    >
                                        <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={cancelEdit}
                                        className="p-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                                        title="Cancel"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                {/* Color picker row */}
                                <div className="flex items-center gap-1.5 flex-wrap pl-0.5">
                                    {availableColors.map((color) => (
                                        <button
                                            key={color}
                                            onClick={() => { setEditColor(color); setEditCustomColor(''); }}
                                            className="w-5 h-5 rounded-full border-2 transition-all"
                                            style={{
                                                backgroundColor: color,
                                                borderColor: !editCustomColor && editColor === color ? '#18181b' : 'transparent',
                                                transform: !editCustomColor && editColor === color ? 'scale(1.15)' : 'scale(1)',
                                            }}
                                        />
                                    ))}
                                    <div className="w-px h-4 bg-zinc-200 dark:bg-white/10 mx-0.5" />
                                    <label className="relative w-5 h-5 rounded-full overflow-hidden border-2 border-zinc-200 dark:border-zinc-700 cursor-pointer">
                                        <input
                                            type="color"
                                            value={editCustomColor || editColor}
                                            onChange={(e) => setEditCustomColor(e.target.value)}
                                            className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer"
                                        />
                                    </label>
                                </div>
                            </div>
                        ) : (
                            /* Display mode */
                            <>
                                <span
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white shadow-sm flex-shrink-0"
                                    style={{ backgroundColor: item.color }}
                                >
                                    {item.name}
                                </span>
                                <div className="flex-1" />
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => startEdit(item)}
                                        className="p-1 rounded-md text-zinc-400 hover:text-primary hover:bg-primary/10 transition-colors"
                                        title="Edit"
                                    >
                                        <Pencil className="w-3 h-3" />
                                    </button>
                                    <button
                                        onClick={() => { onDelete(item.id); toast.info(t.tags_removed); }}
                                        className="p-1 rounded-md text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                                        title="Delete"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
                {items.length === 0 && (
                    <p className="text-xs text-zinc-400 dark:text-zinc-600 italic py-2 pl-1">No tags yet</p>
                )}
            </div>

            {/* Add new tag */}
            <div className="space-y-3 mt-4 pt-4 border-t border-zinc-100 dark:border-white/5">
                <h4 className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">{t.tags_add_new}</h4>
                <div className="flex gap-2">
                    <input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                        placeholder={`${title} name...`}
                        className="flex-1 text-sm bg-white dark:bg-zinc-950 text-zinc-950 dark:text-white border border-zinc-200/60 dark:border-white/5 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 transition-colors"
                    />
                    <button
                        onClick={handleAdd}
                        className="px-3 py-1.5 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium rounded-xl transition-colors"
                    >
                        <Plus strokeWidth={1.5} className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                    {availableColors.slice(0, 8).map((color) => (
                        <button
                            key={color}
                            onClick={() => { setSelectedColor(color); setCustomColor(''); }}
                            className="w-6 h-6 rounded-full border-2 transition-all"
                            style={{
                                backgroundColor: color,
                                borderColor: !customColor && selectedColor === color ? '#71717a' : 'transparent',
                                transform: !customColor && selectedColor === color ? 'scale(1.1)' : 'scale(1)'
                            }}
                            title={t.tags_select_color}
                        />
                    ))}
                    <div className="w-px h-4 bg-zinc-200 dark:bg-white/10 mx-1" />
                    <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 flex items-center gap-2 cursor-pointer">
                        Hex:
                        <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-zinc-200 dark:border-zinc-700">
                            <input
                                type="color"
                                value={customColor || '#000000'}
                                onChange={(e) => setCustomColor(e.target.value)}
                                className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer"
                            />
                        </div>
                    </label>
                </div>
            </div>
        </div>
    );
}

export default function TagsManagerView() {
    const {
        setActiveView,
        pillars, addPillar, deletePillar,
        contentTypes, addContentType, deleteContentType,
        funnels, addFunnel, deleteFunnel,
        statuses, addStatus, deleteStatus,
        updateTag, reorderTags,
        workspaces, activeWorkspaceId,
        setShowWorkspaceSettings
    } = useStore();

    const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);
    const t = useT();

    // Run migration on first load (safe to call multiple times)
    useEffect(() => {
        fetch('/api/migrate-tag-sort', { method: 'POST' }).catch(() => { });
    }, []);

    return (
        <div className="p-8 w-full">
            {/* Header with back button */}
            <div className="mb-8">
                <button
                    onClick={() => { setActiveView('content'); setShowWorkspaceSettings(true); }}
                    className="flex items-center gap-2 text-sm text-text-muted hover:text-primary font-medium mb-4 transition-colors group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                    {t.tags_back}
                </button>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-white shadow-sm">
                        <Tag strokeWidth={1.5} className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-950 dark:text-white">{t.tags_title}</h1>
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-0.5">
                            {t.tags_manage_for} <span className="font-semibold text-primary">{activeWorkspace?.name || 'Workspace'}</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Tags Grid */}
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                <TagSection title={t.tags_pillars} category="pillar" items={pillars} onAdd={addPillar} onDelete={deletePillar} onUpdate={updateTag} onReorder={reorderTags} t={t} />
                <TagSection title={t.tags_funnels} category="funnel" items={funnels} onAdd={addFunnel} onDelete={deleteFunnel} onUpdate={updateTag} onReorder={reorderTags} t={t} />
                <TagSection title={t.tags_types} category="contentType" items={contentTypes} onAdd={addContentType} onDelete={deleteContentType} onUpdate={updateTag} onReorder={reorderTags} t={t} />
                <TagSection title={t.tags_statuses} category="status" items={statuses} onAdd={addStatus} onDelete={deleteStatus} onUpdate={updateTag} onReorder={reorderTags} t={t} />
            </div>
        </div>
    );
}
