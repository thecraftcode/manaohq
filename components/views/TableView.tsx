'use client';

import { useStore, Post, StatusType } from '@/store/useStore';
import { Trash2, ChevronUp, ChevronDown, ExternalLink, Paperclip, FileText, Send, CheckSquare, Square, Edit2, X, Filter, Check } from 'lucide-react';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useT } from '@/lib/i18n';
import { generateDeterministicColor } from '@/lib/colors';

const bdr = 'border-r border-border-subtle dark:border-gray-800';

// ── Custom Fixed Dropdown to fix native Select limitations ──────────────────
function TableDropdown({ value, options, onChange, getStyle, placeholder, className, displayValue }: { value: string, options: { id?: string, name: string, value?: string, label?: string }[], onChange: (val: string) => void, getStyle: (val: string) => React.CSSProperties, placeholder?: string, className?: string, displayValue?: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const dropRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (isOpen && dropRef.current && !dropRef.current.contains(e.target as Node) && btnRef.current && !btnRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        function handleScroll() { setIsOpen(false); }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            window.addEventListener('scroll', handleScroll, true);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [isOpen]);

    const handleSelect = (v: string) => { onChange(v); setIsOpen(false); };
    const { backgroundColor, color } = getStyle(value);

    return (
        <>
            <button ref={btnRef} onClick={() => setIsOpen(!isOpen)}
                className={`text-xs font-bold px-2 py-1 rounded-full cursor-pointer transition-colors outline-none focus:ring-2 focus:ring-primary/50 w-full flex items-center justify-between ${className || ''}`}
                style={{ backgroundColor, color }}>
                <span className="flex-1 text-center truncate">{displayValue || value || placeholder || 'Select...'}</span>
                <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && btnRef.current && (
                <div ref={dropRef}
                    className="fixed z-[9999] bg-surface-white dark:bg-gray-800 rounded-xl border border-border-subtle shadow-xl overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100 min-w-[160px] max-w-[280px]"
                    style={{
                        top: btnRef.current.getBoundingClientRect().bottom + 4,
                        left: btnRef.current.getBoundingClientRect().left + (btnRef.current.getBoundingClientRect().width / 2),
                        transform: 'translateX(-50%)',
                    }}>
                    <div className="max-h-64 overflow-y-auto w-full flex flex-col items-center bg-white dark:bg-gray-800 py-1">
                        {options.map((opt, i) => {
                            const optValue = opt.value !== undefined ? opt.value : opt.name;
                            const optLabel = opt.label !== undefined ? opt.label : opt.name;
                            return (
                                <button key={opt.id || i} onMouseDown={(e) => { e.preventDefault(); handleSelect(optValue); }}
                                    className={`w-full flex-shrink-0 px-3 py-2 text-xs text-center border-b border-transparent hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors ${value === optValue ? 'bg-slate-100 dark:bg-slate-700 font-bold text-primary dark:text-white' : 'text-slate-700 dark:text-gray-200'}`}>
                                    {optLabel}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </>
    );
}



// ── Inline text/date editor ─────────────────────────────────────────────────
function InlineEdit({ value, field, postId, placeholder, isDate, align = 'center', readOnly = false }: { value: string; field: keyof Post; postId: string; placeholder?: string; isDate?: boolean; align?: 'left' | 'center' | 'right'; readOnly?: boolean }) {
    const updatePostFields = useStore(s => s.updatePostFields);
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState(value);
    const isSavingRef = useRef(false);
    const ref = useRef<HTMLInputElement>(null);

    useEffect(() => { setText(value); }, [value]);
    useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);

    const save = async () => {
        if (isSavingRef.current) return;
        const trimmed = text.trim();
        if (trimmed === value) {
            setEditing(false);
            return;
        }

        isSavingRef.current = true;
        setEditing(false);
        try {
            await updatePostFields(postId, { [field]: trimmed } as Partial<Post>);
            toast.success(`Updated`);
        } catch (err: any) {
            setText(value);
            toast.error(err?.message || 'Gagal menyimpan perubahan');
        } finally {
            isSavingRef.current = false;
        }
    };

    let displayValue = value;
    if (isDate && value) {
        const parts = value.split('-');
        if (parts.length === 3) {
            displayValue = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
    }

    if (readOnly) {
        return (
            <p className={`text-xs text-text-main dark:text-gray-200 truncate py-0.5 text-${align}`}
                title={displayValue || placeholder || '—'}>
                {displayValue || <span className="text-text-muted dark:text-gray-500">{placeholder || '—'}</span>}
            </p>
        );
    }

    if (editing) {
        return (
            <input
                ref={ref}
                type={isDate ? 'date' : 'text'}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={save}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        save();
                    } else if (e.key === 'Escape') {
                        setText(value);
                        setEditing(false);
                    }
                }}
                className={`w-full text-xs border-border-subtle bg-surface-white dark:bg-gray-800 border rounded px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-primary/50 text-text-main dark:text-gray-200 text-${align}`}
            />
        );
    }

    return (
        <p onClick={() => setEditing(true)}
            className={`text-xs text-text-main dark:text-gray-200 truncate cursor-text hover:text-primary dark:hover:text-primary transition-colors py-0.5 text-${align}`}
            title={displayValue || placeholder || 'Click to edit'}>
            {displayValue || <span className="text-text-muted dark:text-gray-500">{placeholder || '—'}</span>}
        </p>
    );
}

function InlineUrlEdit({ value, field, postId, icon: Icon, readOnly }: { value: string; field: keyof Post; postId: string; icon: typeof Paperclip; readOnly?: boolean }) {
    const updatePostFields = useStore(s => s.updatePostFields);
    const [editing, setEditing] = useState(false);
    const [showOptions, setShowOptions] = useState(false);
    const [text, setText] = useState(value || '');
    const [isSaving, setIsSaving] = useState(false);
    const isSavingRef = useRef(false);
    const ref = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Sync local text whenever prop value updates from store
    useEffect(() => {
        if (!editing) {
            setText(value || '');
        }
    }, [value, editing]);

    useEffect(() => {
        if (editing && ref.current) ref.current.focus();
    }, [editing]);

    // Close options when clicking outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowOptions(false);
            }
        }
        if (showOptions) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showOptions]);

    const save = async () => {
        if (isSavingRef.current) return;
        const newText = text.trim();
        if (newText === (value || '')) {
            setEditing(false);
            return;
        }

        isSavingRef.current = true;
        setIsSaving(true);
        setEditing(false);

        try {
            await updatePostFields(postId, { [field]: newText } as Partial<Post>);
            setText(newText);
            toast.success('Link berhasil disimpan');

            // --- BACKGROUND CAPTION FETCH MAGIC ---
            if (field === 'publishedLink' && newText.includes('instagram.com')) {
                const toastId = toast.loading('Menyedot caption dari IG di latar belakang...');
                try {
                    const res = await fetch('/api/fetch-ig', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: newText }),
                    });

                    if (!res.ok) {
                        toast.error('Error saat menarik caption. Pastikan URL publik.', { id: toastId });
                        return;
                    }

                    const data = await res.json();
                    if (data.caption || data.thumbnailUrl) {
                        const updates: Partial<Post> = {};
                        if (data.caption) updates.caption = data.caption;
                        if (data.thumbnailUrl) updates.thumbnailUrl = data.thumbnailUrl;

                        await updatePostFields(postId, updates);
                        toast.success('Data IG berhasil ditarik & disimpan!', { id: toastId });
                    } else {
                        toast.error('Gagal menarik data dari link ini.', { id: toastId });
                    }
                } catch (error) {
                    console.error("Fetch Error:", error);
                    toast.error('Error saat menarik caption. Pastikan URL publik.', { id: toastId });
                }
            }
            // ----------------------------------------
        } catch (err: any) {
            console.error('Error updating URL field:', err);
            setText(value || '');
            toast.error(err?.message || 'Gagal memperbarui link asset');
        } finally {
            isSavingRef.current = false;
            setIsSaving(false);
        }
    };

    if (editing) {
        return (
            <input
                ref={ref}
                type="url"
                value={text}
                disabled={isSaving}
                onChange={(e) => setText(e.target.value)}
                onBlur={save}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        save();
                    } else if (e.key === 'Escape') {
                        setText(value || '');
                        setEditing(false);
                    }
                }}
                placeholder="https://..."
                className="w-full text-[10px] bg-white dark:bg-gray-900 border border-border-subtle rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary/50 text-text-main dark:text-white disabled:opacity-50"
            />
        );
    }

    if (isSaving) {
        return (
            <div className="inline-flex items-center justify-center w-6 h-6">
                <span className="material-symbols-outlined text-[14px] animate-spin text-primary">progress_activity</span>
            </div>
        );
    }

    // Use value from store, or fall back to local text if optimistic/just saved
    const effectiveValue = value || text;

    if (effectiveValue) {
        if (showOptions) {
            return (
                <div className="flex items-center justify-center gap-1.5 animate-in fade-in zoom-in-95 duration-200" ref={containerRef}>
                    {!readOnly && (
                        <button
                            className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400 text-[10px] font-bold transition-colors"
                            onClick={(e) => { e.stopPropagation(); setShowOptions(false); setEditing(true); }}>
                            Edit
                        </button>
                    )}
                    <a href={effectiveValue} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 text-[10px] font-bold transition-colors"
                        onClick={(e) => { e.stopPropagation(); setShowOptions(false); }}>
                        Open
                    </a>
                </div>
            );
        }

        return (
            <button onClick={(e) => {
                e.stopPropagation();
                if (readOnly) {
                    window.open(effectiveValue, '_blank', 'noopener,noreferrer');
                } else {
                    setShowOptions(true);
                }
            }}
                className="inline-flex items-center justify-center w-6 h-6 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 transition-colors"
                title={readOnly ? "Open Link" : "Options"}>
                <Icon className="w-3.5 h-3.5" />
            </button>
        );
    }

    if (readOnly) {
        return <span className="text-text-muted dark:text-gray-500 text-xs">—</span>;
    }

    return (
        <button onClick={() => setEditing(true)}
            className="text-text-muted dark:text-gray-500 hover:text-primary text-xs transition-colors p-1" title="Add link">
            —
        </button>
    );
}

// ── Table Row ───────────────────────────────────────────────────────────────
const TableRow = React.memo(function TableRow({ post, index, isSelected, onSelect, hideBulk }: { post: Post; index: number; isSelected: boolean; onSelect: (id: string, selected: boolean) => void; hideBulk?: boolean }) {
    const { updatePostFields, deletePost, pillars: storePillars, teamMembers, contentTypes: storeTypes, funnels: storeFunnels, statuses: storeStatuses, openDrawer, toggleFocusMode, activeRole } = useStore();
    const isMember = activeRole === 'member';
    const pillars = storePillars || [];
    const team = teamMembers || [];
    const types = storeTypes || [];
    const funnels = storeFunnels || [];
    const statuses = storeStatuses || [];

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: post.id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: isDragging ? 'relative' as 'relative' : 'static' as 'static',
        zIndex: isDragging ? 50 : 'auto',
    };

    const td = 'px-2 py-2 text-xs';
    const pillClass = "w-full text-xs font-semibold rounded-full px-2 py-1 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 ring-1 ring-border-subtle transition-all text-center";

    const getTagColor = (val: string, items: { name: string, color: string }[]) => {
        const found = items.find(i => i.name === val);
        if (!found) return { backgroundColor: '#f1f5f9', color: '#64748b' }; // slate-100 / slate-500 fallback
        return { backgroundColor: found.color, color: '#ffffff', borderColor: found.color };
    };

    const handleShareWA = (post: any) => {
        // Fallback to publishedLink/assetLink which are the actual keys in the Post interface,
        // but checking post.link and post.asset first as requested.
        const igLink = post.link || post.publishedLink || 'Belum ada link';
        const gdriveLink = post.asset || post.assetLink || 'Belum ada link';
        const postCaption = post.caption || 'Belum ada caption';
        const postThumbnail = post.thumbnailUrl || '';
        const hiddenThumbnailHack = postThumbnail ? `\n\n\n\n\n.\n${postThumbnail}` : '';

        const message = `${igLink}\n\n*Download File HD*\n${gdriveLink}\n\n*Caption*\n${postCaption}${hiddenThumbnailHack}`;
        const encodedString = encodeURIComponent(message);

        // Auto-update status to "Shared"
        if (post.status !== 'Shared') {
            updatePostFields(post.id, { status: 'Shared' });
            toast.success('Status diubah ke Shared');
        }

        window.location.href = `whatsapp://send?text=${encodedString}`;
    };

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const isToday = post.postDate === todayStr;

    return (
        <tr ref={setNodeRef} style={style} className={`group transition-colors ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : isToday ? 'bg-rose-100 dark:bg-rose-900/40 hover:bg-rose-200 dark:hover:bg-rose-800/50' : 'hover:bg-background-light dark:hover:bg-gray-800'}`}>
            {/* Checkbox — hidden unless hideBulk is false (which is controlled by isSelectionMode) */}
            {!hideBulk && (
                <td className={`${td} ${bdr} text-center`}>
                    <button
                        onClick={() => onSelect(post.id, !isSelected)}
                        className="text-text-muted hover:text-primary transition-colors focus:outline-none flex items-center justify-center w-full"
                    >
                        {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                        ) : (
                            <Square className="w-4 h-4" />
                        )}
                    </button>
                </td>
            )}

            {/* Drag Handle */}
            <td className={`${td} ${bdr} text-center cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600`} {...attributes} {...listeners}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
            </td>

            {/* No */}
            <td className={`${td} ${bdr} text-center font-mono text-text-muted dark:text-gray-500`}>
                {String(index + 1).padStart(2, '0')}
            </td>

            {/* Idea — left aligned, truncated */}
            <td className={`${td} ${bdr} max-w-[250px] truncate text-left`}>
                <InlineEdit value={post.idea} field="idea" postId={post.id} placeholder="Enter idea..." align="left" readOnly={isMember} />
            </td>

            {/* Pillar */}
            <td className={`${td} ${bdr} text-center`}>
                {isMember ? (
                    <span className="text-xs font-semibold rounded-full px-2 py-1 inline-block" style={getTagColor(post.pillar || '', pillars)}>{post.pillar || '—'}</span>
                ) : (
                    <TableDropdown
                        value={post.pillar || ''}
                        options={[...pillars, ...(post.pillar && !pillars.some(p => p.name === post.pillar) ? [{ name: post.pillar, id: 'custom' }] : [])]}
                        onChange={(val) => { updatePostFields(post.id, { pillar: val }); toast.success('Updated'); }}
                        getStyle={(val) => getTagColor(val, pillars)}
                        placeholder="Select..."
                    />
                )}
            </td>

            {/* PIC */}
            <td className={`${td} ${bdr} text-center`}>
                {isMember ? (
                    <span className="text-xs font-semibold rounded-full px-2 py-1 inline-block" style={{ backgroundColor: generateDeterministicColor(post.pic || ''), color: '#ffffff' }}>{post.pic || 'Unassigned'}</span>
                ) : (
                    <TableDropdown
                        value={post.pic || ''}
                        options={[{ name: 'Unassigned', id: 'unassigned' }, ...team, ...(post.pic && post.pic !== 'Unassigned' && !team.some(m => m.name === post.pic) ? [{ name: post.pic, id: 'custom' }] : [])]}
                        onChange={(val) => { updatePostFields(post.id, { pic: val === 'Unassigned' ? '' : val }); toast.success('Updated'); }}
                        getStyle={(val) => ({ backgroundColor: generateDeterministicColor(val), color: '#ffffff' })}
                        placeholder="Unassigned"
                    />
                )}
            </td>

            {/* Funnel */}
            <td className={`${td} ${bdr} text-center`}>
                {isMember ? (
                    <span className="text-xs font-semibold rounded-full px-2 py-1 inline-block" style={getTagColor(post.funnel || '', funnels)}>{post.funnel || '—'}</span>
                ) : (
                    <TableDropdown
                        value={post.funnel || ''}
                        options={[...funnels, ...(post.funnel && !funnels.some(f => f.name === post.funnel) ? [{ name: post.funnel, id: 'custom' }] : [])]}
                        onChange={(val) => { updatePostFields(post.id, { funnel: val }); toast.success('Updated'); }}
                        getStyle={(val) => getTagColor(val, funnels)}
                        placeholder="Select..."
                    />
                )}
            </td>

            {/* Type — dropdown */}
            <td className={`${td} ${bdr} text-center`}>
                {isMember ? (
                    <span className="text-xs font-semibold rounded-full px-2 py-1 inline-block" style={getTagColor(post.type || '', types)}>{post.type || '—'}</span>
                ) : (
                    <TableDropdown
                        value={post.type || ''}
                        options={[...types, ...(post.type && !types.some(t => t.name === post.type) ? [{ name: post.type, id: 'custom' }] : [])]}
                        onChange={(val) => { updatePostFields(post.id, { type: val }); toast.success('Updated'); }}
                        getStyle={(val) => getTagColor(val, types)}
                        placeholder="Select..."
                    />
                )}
            </td>

            {/* Deadline */}
            <td className={`${td} ${bdr} text-center`}>
                <InlineEdit value={post.deadline || ''} field="deadline" postId={post.id} placeholder="—" isDate readOnly={isMember} />
            </td>

            {/* Post Date */}
            <td className={`${td} ${bdr} text-center`}>
                <InlineEdit value={post.postDate || ''} field="postDate" postId={post.id} placeholder="—" isDate readOnly={isMember} />
            </td>

            {/* Brief */}
            <td className={`${td} ${bdr} text-center`}>
                {isMember ? (
                    post.script && post.script.trim() !== '' ? (
                        <button onClick={() => { openDrawer(post); toggleFocusMode(); }}
                            className="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 transition-colors"
                            title="View Script">
                            <FileText className="w-3 h-3" />
                        </button>
                    ) : (
                        <span className="text-text-muted dark:text-gray-500 text-xs">—</span>
                    )
                ) : (
                    post.script && post.script.trim() !== '' ? (
                        <button onClick={() => { openDrawer(post); toggleFocusMode(); }}
                            className="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 transition-colors"
                            title="View Script">
                            <FileText className="w-3 h-3" />
                        </button>
                    ) : (
                        <button onClick={() => { openDrawer(post); toggleFocusMode(); }}
                            className="text-text-muted dark:text-gray-500 hover:text-primary transition-colors text-xs p-1"
                            title="Write Script">
                            —
                        </button>
                    )
                )}
            </td>

            {/* Reference */}
            <td className={`${td} ${bdr} text-center`}>
                <InlineUrlEdit value={post.referenceUrl || ''} field="referenceUrl" postId={post.id} icon={ExternalLink} readOnly={isMember} />
            </td>

            {/* Asset */}
            <td className={`${td} ${bdr} text-center`}>
                <InlineUrlEdit value={post.assetLink || ''} field="assetLink" postId={post.id} icon={Paperclip} />
            </td>

            {/* Link */}
            <td className={`${td} ${bdr} text-center`}>
                <InlineUrlEdit value={post.publishedLink || ''} field="publishedLink" postId={post.id} icon={ExternalLink} />
            </td>

            {/* Status */}
            <td className={`${td} ${bdr} text-center`}>
                <TableDropdown
                    value={post.status || ''}
                    options={[...statuses, ...(post.status && !statuses.some(s => s.name === post.status) ? [{ name: post.status as string, id: 'custom' }] : [])]}
                    onChange={(val) => { updatePostFields(post.id, { status: val as StatusType }); toast.success('Updated'); }}
                    getStyle={(val) => getTagColor(val, statuses)}
                    placeholder="Select..."
                />
            </td>

            {/* Actions */}
            <td className="px-2 py-2 text-center w-[80px]">
                <div className="flex items-center justify-center gap-1">
                    <button onClick={() => handleShareWA(post)}
                        className="p-1.5 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-md transition-all" title="Share to WhatsApp">
                        <Send className="w-4 h-4" />
                    </button>
                    {!isMember && (
                        <>
                            <button onClick={async () => {
                                const { id, created_at, ...postData } = post;
                                await useStore.getState().addPost({ ...postData, idea: `${postData.idea} (Copy)` } as Post);
                                toast.success('Berhasil duplikat konten');
                            }}
                                className="p-1.5 text-blue-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-md transition-all" title="Duplikat">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            </button>
                            <button onClick={() => { deletePost(post.id); toast.success('Deleted'); }}
                                className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-md transition-all" title="Delete">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </>
                    )}
                </div>
            </td>
        </tr>
    );
});

// ── Table View ──────────────────────────────────────────────────────────────
type SortDirection = 'asc' | 'desc' | null;
type SortKey = keyof Post | null;

export default function TableView({ posts, isSelectionMode, setIsSelectionMode }: { posts: Post[], isSelectionMode?: boolean, setIsSelectionMode?: (v: boolean) => void }) {
    const { bulkDeletePosts, bulkUpdatePosts, pillars: storePillars, funnels: storeFunnels, contentTypes: storeTypes, statuses: storeStatuses, teamMembers, activeRole, manualPostOrder, setManualPostOrder, activeWorkspaceId } = useStore();
    const isMember = activeRole === 'member';
    const [sortKey, setSortKey] = useState<SortKey>('postDate');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);
    
    // Column Filtering State
    const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
    const [activeFilterColumn, setActiveFilterColumn] = useState<keyof Post | null>(null);
    const filterPopoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterPopoverRef.current && !filterPopoverRef.current.contains(event.target as Node)) {
                setActiveFilterColumn(null);
            }
        };
        if (activeFilterColumn) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeFilterColumn]);

    const toggleColumnFilter = (key: string, val: string) => {
        setColumnFilters(prev => {
            const current = prev[key] || [];
            if (current.includes(val)) {
                return { ...prev, [key]: current.filter(v => v !== val) };
            }
            return { ...prev, [key]: [...current, val] };
        });
    };

    // Bulk Edit State
    const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [bulkUpdates, setBulkUpdates] = useState<Partial<Post>>({});

    const t = useT();

    // Clear selection when mode changes or posts change
    useEffect(() => {
        setSelectedIds(new Set());
    }, [posts.length, isSelectionMode]);

    const handleSelectAll = () => {
        if (selectedIds.size === posts.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(posts.map(p => p.id)));
        }
    };

    const handleSelectRow = (id: string, selected: boolean) => {
        const next = new Set(selectedIds);
        if (selected) next.add(id);
        else next.delete(id);
        setSelectedIds(next);
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        const confirmDelete = window.confirm(`Apakah Anda yakin ingin menghapus ${selectedIds.size} post terpilih?`);
        if (!confirmDelete) return;

        setIsDeleting(true);
        try {
            await bulkDeletePosts(Array.from(selectedIds));
            toast.success(`${selectedIds.size} post dihapus`);
            setSelectedIds(new Set());
        } catch (error) {
            toast.error('Gagal menghapus post secara massal');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleBulkEditSubmit = async () => {
        if (selectedIds.size === 0 || Object.keys(bulkUpdates).length === 0) {
            setIsBulkEditOpen(false);
            return;
        }

        setIsUpdating(true);
        try {
            await bulkUpdatePosts(Array.from(selectedIds), bulkUpdates);
            toast.success(`${selectedIds.size} post berhasil diperbarui`);
            setSelectedIds(new Set());
            setIsBulkEditOpen(false);
            setBulkUpdates({});
        } catch (error) {
            toast.error('Gagal memperbarui post secara massal');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleSort = (key: keyof Post) => {
        if (sortKey === key) {
            if (sortDirection === 'asc') setSortDirection('desc');
            else if (sortDirection === 'desc') { setSortDirection(null); setSortKey(null); }
        } else { setSortKey(key); setSortDirection('asc'); }
    };

    const sortedPosts = useMemo(() => {
        let result = [...posts];
        
        // 1. Column filters
        Object.entries(columnFilters).forEach(([key, activeFilters]) => {
            if (activeFilters && activeFilters.length > 0) {
                result = result.filter(p => {
                    const val = p[key as keyof Post];
                    const valStr = typeof val === 'string' ? val : (val ? String(val) : 'Unassigned');
                    // Consider empty strings as 'Unassigned'
                    return activeFilters.includes(valStr) || (valStr === '' && activeFilters.includes('Unassigned'));
                });
            }
        });

        // 2. Always apply manual sorting first
        const workspaceId = activeWorkspaceId || 'default';
        const manualOrder = manualPostOrder?.[workspaceId] || [];
        if (manualOrder && manualOrder.length > 0) {
            result.sort((a, b) => {
                const indexA = manualOrder.indexOf(a.id);
                const indexB = manualOrder.indexOf(b.id);
                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                if (indexA !== -1) return -1;
                if (indexB !== -1) return 1;
                return 0;
            });
        }

        // Apply column sort if active
        if (sortKey && sortDirection) {
            result.sort((a, b) => {
                const aVal = a[sortKey] || '';
                const bVal = b[sortKey] || '';
                if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return result;
    }, [posts, sortKey, sortDirection, manualPostOrder, activeWorkspaceId, columnFilters]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = sortedPosts.findIndex(p => p.id === active.id);
            const newIndex = sortedPosts.findIndex(p => p.id === over.id);
            const newArray = arrayMove(sortedPosts, oldIndex, newIndex);
            
            const workspaceId = activeWorkspaceId || 'default';
            setManualPostOrder(workspaceId, newArray.map(p => p.id));
        }
    };

    // Column definitions: width uses strict px values, NO percentages
    const headers: { label: React.ReactNode; key?: keyof Post; className: string; filterable?: boolean; filterOptions?: string[] }[] = [
        // Checkbox column
        ...(isSelectionMode ? [{
            label: (
                <button
                    onClick={handleSelectAll}
                    title="Select All"
                    className="flex justify-center w-full focus:outline-none"
                    disabled={posts.length === 0}
                >
                    {posts.length > 0 && selectedIds.size === posts.length ? (
                        <CheckSquare className="w-4 h-4 text-primary" />
                    ) : (
                        <Square className="w-4 h-4 text-text-muted hover:text-primary transition-colors" />
                    )}
                </button>
            ) as React.ReactNode,
            className: 'w-[40px] min-w-[40px]'
        }] : []),
        { label: '', className: 'w-[30px] min-w-[30px]' }, // Drag handle
        { label: 'No', className: 'w-[40px] min-w-[40px]' },
        { label: t.table_idea, key: 'idea' as keyof Post, className: 'min-w-[250px] px-4' },
        { label: t.table_pillar, key: 'pillar' as keyof Post, className: 'min-w-[140px]', filterable: true, filterOptions: storePillars.map(p => p.name) },
        { label: t.table_pic, key: 'pic' as keyof Post, className: 'min-w-[140px]', filterable: true, filterOptions: [...teamMembers.map(m => m.name), 'Unassigned'] },
        { label: t.table_funnel, key: 'funnel' as keyof Post, className: 'min-w-[140px]', filterable: true, filterOptions: storeFunnels.map(f => f.name) },
        { label: t.table_type, key: 'type' as keyof Post, className: 'min-w-[140px]', filterable: true, filterOptions: storeTypes.map(t => t.name) },
        { label: t.table_deadline, key: 'deadline' as keyof Post, className: 'min-w-[120px]' },
        { label: t.table_post_date, key: 'postDate' as keyof Post, className: 'min-w-[120px]' },
        { label: t.table_brief, key: 'brief' as keyof Post, className: 'min-w-[120px]' },
        { label: t.table_reference, key: 'referenceUrl' as keyof Post, className: 'min-w-[100px]' },
        { label: t.table_asset, key: 'assetLink' as keyof Post, className: 'min-w-[100px]' },
        { label: t.table_link, key: 'publishedLink' as keyof Post, className: 'min-w-[100px]' },
        { label: t.table_status, key: 'status' as keyof Post, className: 'min-w-[120px]', filterable: true, filterOptions: storeStatuses.map(s => s.name) },
        { label: t.table_action, className: 'w-[80px] min-w-[80px]' },
    ];

    if (!posts) return null;

    const getTagColorForEdit = (val: string, items: { name: string, color: string }[]) => {
        if (!val) return { backgroundColor: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }; // Empty/Neutral
        const found = items.find(i => i.name === val);
        if (!found) return { backgroundColor: '#f1f5f9', color: '#64748b' };
        return { backgroundColor: found.color, color: '#ffffff', borderColor: found.color };
    };

    const getPicColorForEdit = (val: string) => {
        if (!val) return { backgroundColor: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' };
        if (val === 'Unassigned') return { backgroundColor: '#94a3b8', color: '#ffffff' };
        return { backgroundColor: generateDeterministicColor(val), color: '#ffffff' };
    };

    return (
        <div className="bg-surface-white dark:bg-gray-900 rounded-xl border border-border-subtle dark:border-gray-800 shadow-sm overflow-auto w-full flex-1 min-h-0 transition-colors flex flex-col table-container custom-scrollbar">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="w-full text-left whitespace-nowrap border-collapse table-auto">
                <thead className="sticky top-0 z-10">
                    <tr className="bg-background-light dark:bg-gray-900 border-b-2 border-border-subtle dark:border-gray-800">
                        {headers.map((h, i) => (
                            <th key={i}
                                className={`px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted dark:text-gray-400 select-none text-center ${h.className} ${i < headers.length - 1 ? bdr : ''} relative`}>
                                <div className={`inline-flex items-center gap-1 justify-center w-full ${h.key ? 'cursor-pointer hover:text-text-main dark:hover:text-gray-200' : ''}`} onClick={(e) => {
                                    if (h.key && !(e.target as HTMLElement).closest('.filter-btn')) {
                                        handleSort(h.key);
                                    }
                                }}>
                                    {h.label}
                                    {h.key && sortKey === h.key && (
                                        sortDirection === 'asc'
                                            ? <ChevronUp className="w-3 h-3 text-primary" />
                                            : <ChevronDown className="w-3 h-3 text-primary" />
                                    )}
                                    {h.filterable && h.key && (
                                        <div className="relative filter-btn" onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveFilterColumn(activeFilterColumn === h.key ? null : (h.key as keyof Post));
                                        }}>
                                            <Filter className={`w-3.5 h-3.5 hover:text-primary transition-colors ${(h.key && columnFilters[h.key]?.length) ? 'text-primary fill-primary/20' : 'text-gray-400'}`} />
                                            
                                            {activeFilterColumn === h.key && (
                                                <div ref={filterPopoverRef} className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 text-left cursor-default animate-in fade-in zoom-in-95 duration-200">
                                                    <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 font-medium text-xs text-text-main dark:text-gray-200 flex justify-between items-center">
                                                        <span>Filter {h.label}</span>
                                                        {(h.key && columnFilters[h.key]?.length > 0) && (
                                                            <button onClick={() => setColumnFilters(p => ({ ...p, [h.key as string]: [] }))} className="text-primary hover:text-primary-hover text-[10px]">
                                                                Reset
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="max-h-48 overflow-y-auto p-1 custom-scrollbar">
                                                        {h.filterOptions?.map(opt => {
                                                            const isChecked = columnFilters[h.key!]?.includes(opt);
                                                            return (
                                                                <button
                                                                    key={opt}
                                                                    onClick={(e) => { e.stopPropagation(); toggleColumnFilter(h.key as string, opt); }}
                                                                    className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md transition-colors text-left"
                                                                >
                                                                    <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${isChecked ? 'bg-primary border-primary' : 'border-gray-300 dark:border-gray-600'}`}>
                                                                        {isChecked && <Check className="w-2.5 h-2.5 text-white" />}
                                                                    </div>
                                                                    <span className="text-xs text-text-main dark:text-gray-300 truncate" title={opt}>{opt}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>

                <SortableContext items={sortedPosts.map(p => p.id)} strategy={verticalListSortingStrategy}>
                <tbody className="divide-y divide-border-subtle dark:divide-gray-800">
                    {sortedPosts.length === 0 ? (
                        <tr>
                            <td colSpan={headers.length} className="py-24 text-center">
                                <p className="text-slate-400 dark:text-slate-500 text-sm font-medium">{t.table_no_match}</p>
                            </td>
                        </tr>
                    ) : (
                        sortedPosts.map((post: Post, i: number) => (
                            <TableRow
                                key={post.id}
                                post={post}
                                index={i}
                                isSelected={selectedIds.has(post.id)}
                                onSelect={handleSelectRow}
                                hideBulk={!isSelectionMode}
                            />
                        ))
                    )}
                </tbody>
                </SortableContext>
            </table>
            </DndContext>

            {/* Floating Bulk Action Bar */}
            {/* Floating Bulk Action Bar — hidden for members */}
            {!isMember && selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-gray-900 border border-gray-800 shadow-2xl rounded-full px-6 py-3 animate-in fade-in slide-in-from-bottom-8 duration-300">
                    <span className="text-white text-sm font-medium">
                        {selectedIds.size} terpilih
                    </span>
                    <div className="w-px h-5 bg-gray-700" />
                    <button
                        onClick={handleBulkDelete}
                        disabled={isDeleting || isUpdating}
                        className="flex items-center gap-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                        <Trash2 className="w-4 h-4" />
                        {isDeleting ? 'Menghapus...' : 'Hapus'}
                    </button>
                    <button
                        onClick={() => {
                            setBulkUpdates({});
                            setIsBulkEditOpen(true);
                        }}
                        disabled={isDeleting || isUpdating}
                        className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                        <Edit2 className="w-4 h-4" />
                        Edit Massal
                    </button>
                    <button
                        onClick={() => setSelectedIds(new Set())}
                        title="Batal"
                        className="p-1 text-gray-400 hover:text-white transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}

            {/* Bulk Edit Modal */}
            {isBulkEditOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={() => !isUpdating && setIsBulkEditOpen(false)} />
                    <div className="bg-surface-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle/50 dark:border-gray-800">
                            <h3 className="text-lg font-bold text-text-main dark:text-white">Edit Massal ({selectedIds.size} Konten)</h3>
                            <button onClick={() => !isUpdating && setIsBulkEditOpen(false)} className="text-text-muted hover:text-text-main dark:hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            <p className="text-sm text-text-muted mb-4">Pilih field yang ingin diubah. Biarkan kosong jika tidak ingin mengubah field tersebut pada konten yang dipilih.</p>

                            {/* Pillar */}
                            <div>
                                <label className="block text-sm font-medium text-text-main dark:text-gray-200 mb-2">Pillar</label>
                                <TableDropdown
                                    value={bulkUpdates.pillar || ''}
                                    displayValue={bulkUpdates.pillar ? bulkUpdates.pillar : '-- Biarkan (Tidak Diubah) --'}
                                    options={[{ name: '', label: '-- Biarkan (Tidak Diubah) --', value: '' }, ...(storePillars || [])]}
                                    onChange={(val) => setBulkUpdates(prev => ({ ...prev, pillar: val || undefined }))}
                                    getStyle={(val) => getTagColorForEdit(val, storePillars || [])}
                                    className="py-2 text-sm max-w-full"
                                />
                            </div>

                            {/* PIC */}
                            <div>
                                <label className="block text-sm font-medium text-text-main dark:text-gray-200 mb-2">PIC</label>
                                <TableDropdown
                                    value={bulkUpdates.pic || ''}
                                    displayValue={bulkUpdates.pic ? bulkUpdates.pic : '-- Biarkan (Tidak Diubah) --'}
                                    options={[{ name: '', label: '-- Biarkan (Tidak Diubah) --', value: '' }, { name: 'Unassigned' }, ...(teamMembers || []).map(m => ({ name: m.name }))]}
                                    onChange={(val) => setBulkUpdates(prev => ({ ...prev, pic: val || undefined }))}
                                    getStyle={getPicColorForEdit}
                                    className="py-2 text-sm max-w-full"
                                />
                            </div>

                            {/* Funnel */}
                            <div>
                                <label className="block text-sm font-medium text-text-main dark:text-gray-200 mb-2">Funnel</label>
                                <TableDropdown
                                    value={bulkUpdates.funnel || ''}
                                    displayValue={bulkUpdates.funnel ? bulkUpdates.funnel : '-- Biarkan (Tidak Diubah) --'}
                                    options={[{ name: '', label: '-- Biarkan (Tidak Diubah) --', value: '' }, ...(storeFunnels || [])]}
                                    onChange={(val) => setBulkUpdates(prev => ({ ...prev, funnel: val || undefined }))}
                                    getStyle={(val) => getTagColorForEdit(val, storeFunnels || [])}
                                    className="py-2 text-sm max-w-full"
                                />
                            </div>

                            {/* Format / Type */}
                            <div>
                                <label className="block text-sm font-medium text-text-main dark:text-gray-200 mb-2">Format</label>
                                <TableDropdown
                                    value={bulkUpdates.type || ''}
                                    displayValue={bulkUpdates.type ? bulkUpdates.type : '-- Biarkan (Tidak Diubah) --'}
                                    options={[{ name: '', label: '-- Biarkan (Tidak Diubah) --', value: '' }, ...(storeTypes || [])]}
                                    onChange={(val) => setBulkUpdates(prev => ({ ...prev, type: val || undefined }))}
                                    getStyle={(val) => getTagColorForEdit(val, storeTypes || [])}
                                    className="py-2 text-sm max-w-full"
                                />
                            </div>

                            {/* Status */}
                            <div>
                                <label className="block text-sm font-medium text-text-main dark:text-gray-200 mb-2">Status</label>
                                <TableDropdown
                                    value={bulkUpdates.status || ''}
                                    displayValue={bulkUpdates.status ? bulkUpdates.status : '-- Biarkan (Tidak Diubah) --'}
                                    options={[{ name: '', label: '-- Biarkan (Tidak Diubah) --', value: '' }, ...(storeStatuses || [])]}
                                    onChange={(val) => setBulkUpdates(prev => ({ ...prev, status: val as StatusType || undefined }))}
                                    getStyle={(val) => getTagColorForEdit(val, storeStatuses || [])}
                                    className="py-2 text-sm max-w-full"
                                />
                            </div>

                        </div>
                        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                            <button
                                onClick={() => setIsBulkEditOpen(false)}
                                disabled={isUpdating}
                                className="px-4 py-2 text-sm font-semibold text-text-muted hover:text-text-main dark:hover:text-gray-200 transition-colors disabled:opacity-50"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleBulkEditSubmit}
                                disabled={isUpdating || Object.keys(bulkUpdates).length === 0}
                                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:bg-indigo-600/50 flex items-center gap-2"
                            >
                                {isUpdating && (
                                    <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                                )}
                                Simpan
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
