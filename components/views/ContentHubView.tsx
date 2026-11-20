import { useStore, Post } from '@/store/useStore';
import { useStorePersistent } from '@/store/useStorePersistent';
import { Plus, TableIcon, Columns3, CalendarDays, ChevronRight, Filter, User, X, RotateCcw } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { parseISO, format, getWeekOfMonth, addDays, subDays } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import TableView from './TableView';
import KanbanView from './KanbanView';
import CalendarView from './CalendarView';
import PostDrawer from '../PostDrawer';
import { Building2 } from 'lucide-react';
import WorkspacePresence from '../WorkspacePresence';
import { useT } from '@/lib/i18n';

export default function ContentHubView() {
    const { 
        contentView, setContentView, openDrawer, currentUser, currentUserProfile, 
        activeWorkspaceId, activeRole, bulkAddPosts,
        setContentFilterYear, setContentFilterMonth, setContentFilterWeek, setContentAssignedToMe
    } = useStore();
    const isOwner = ['owner', 'admin'].includes(activeRole || '') || activeRole === null;
    const isMember = activeRole === 'member';
    const posts = useStorePersistent((state) => state.posts) || [];
    const router = useRouter();
    const t = useT();

    // Deep-link: highlight a specific post from notification click
    const [highlightPostId, setHighlightPostId] = useState<string | null>(null);

    // Bulk Insert state
    const [isBulkInsertOpen, setIsBulkInsertOpen] = useState(false);
    const [bulkInsertCount, setBulkInsertCount] = useState<number | ''>(1);
    const [bulkInsertStartDate, setBulkInsertStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [bulkInsertDeadlineOffset, setBulkInsertDeadlineOffset] = useState<number | ''>(2);
    const [isInserting, setIsInserting] = useState(false);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');

    // Selection Mode
    const [isSelectionMode, setIsSelectionMode] = useState(false);

    // Reset date when modal opens
    useEffect(() => {
        if (isBulkInsertOpen) {
            setBulkInsertStartDate(format(new Date(), 'yyyy-MM-dd'));
        }
    }, [isBulkInsertOpen]);

    const handleBulkInsertSubmit = async () => {
        const count = typeof bulkInsertCount === 'number' ? Math.max(1, Math.min(50, bulkInsertCount)) : 1;
        const offset = typeof bulkInsertDeadlineOffset === 'number' ? Math.max(0, bulkInsertDeadlineOffset) : 2;

        if (count < 1) return;
        setIsInserting(true);
        try {
            const newPosts: Omit<Post, 'id' | 'created_at'>[] = [];
            const baseDate = bulkInsertStartDate ? parseISO(bulkInsertStartDate) : new Date();

            for (let i = 0; i < count; i++) {
                const postDateObj = addDays(baseDate, i);
                const deadlineObj = subDays(postDateObj, offset);

                newPosts.push({
                    idea: '',
                    pillar: '',
                    funnel: '',
                    type: '',
                    deadline: format(deadlineObj, 'yyyy-MM-dd'),
                    postDate: format(postDateObj, 'yyyy-MM-dd'),
                    status: 'Draft',
                    assetLink: '',
                    publishedLink: '',
                    script: '',
                    hook: '',
                    caption: '',
                    pic: 'Unassigned',
                    thumbnailUrl: '',
                    referenceUrl: '',
                });
            }

            await bulkAddPosts(newPosts);
            toast.success(`${bulkInsertCount} templates added successfully`);
            setIsBulkInsertOpen(false);
            setBulkInsertCount(1);
        } catch (error) {
            toast.error('Failed to add templates');
        } finally {
            setIsInserting(false);
        }
    };

    // Read highlight_post from URL
    const readHighlightFromUrl = () => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        const postId = params.get('highlight_post');
        const targetWorkspace = params.get('workspace');

        // Switch workspace if needed (e.g. notification from different workspace)
        if (targetWorkspace && targetWorkspace !== activeWorkspaceId) {
            useStore.getState().setActiveWorkspace(targetWorkspace);
        }

        if (postId) {
            setHighlightPostId(postId);
            // Re-fetch posts to ensure the highlighted post is available
            useStore.getState().fetchPosts();
        }
    };

    useEffect(() => {
        readHighlightFromUrl();
    }, [activeWorkspaceId]);

    // Also listen for URL changes from notification click navigation
    useEffect(() => {
        const handleUrlChange = () => readHighlightFromUrl();
        window.addEventListener('popstate', handleUrlChange);

        // Also check on interval briefly after view activation (for router.push navigations)
        const checkTimer = setTimeout(() => readHighlightFromUrl(), 200);

        return () => {
            window.removeEventListener('popstate', handleUrlChange);
            clearTimeout(checkTimer);
        };
    }, [contentView]);

    const clearHighlight = () => {
        setHighlightPostId(null);
        router.replace('/', { scroll: false });
    };

    const now = new Date();
    const currentYear = now.getFullYear().toString();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

    const filterYearState = useStorePersistent(s => s.contentFilterYear);
    const filterMonthState = useStorePersistent(s => s.contentFilterMonth);
    const filterWeekState = useStorePersistent(s => s.contentFilterWeek);
    const assignedToMeState = useStorePersistent(s => s.contentAssignedToMe);

    const filterYear = filterYearState ?? currentYear;
    const filterMonth = filterMonthState ?? currentMonth;
    const filterWeek = filterWeekState ?? 'all';
    const assignedToMe = assignedToMeState ?? false;

    const isFilterDefault = filterYear === currentYear && filterMonth === currentMonth && filterWeek === 'all';
    const resetToToday = () => {
        setContentFilterYear(currentYear);
        setContentFilterMonth(currentMonth);
        setContentFilterWeek('all');
    };

    const viewOptions = [
        { view: 'table' as const, icon: 'table', labelKey: 'content_table' as const },
        { view: 'kanban' as const, icon: 'view_column', labelKey: 'content_kanban' as const },
        { view: 'calendar' as const, icon: 'calendar_month', labelKey: 'content_calendar' as const },
    ];

    const availableYears = useMemo(() => {
        const years = new Set<string>();
        posts.forEach(p => {
            if (p.deadline) years.add(p.deadline.substring(0, 4));
        });
        // Add a few future years for planning
        years.add('2025');
        years.add('2026');
        years.add('2027');
        return Array.from(years).sort().reverse();
    }, [posts]);

    const allMonths = [
        { value: '01', labelKey: 'month_01' as const },
        { value: '02', labelKey: 'month_02' as const },
        { value: '03', labelKey: 'month_03' as const },
        { value: '04', labelKey: 'month_04' as const },
        { value: '05', labelKey: 'month_05' as const },
        { value: '06', labelKey: 'month_06' as const },
        { value: '07', labelKey: 'month_07' as const },
        { value: '08', labelKey: 'month_08' as const },
        { value: '09', labelKey: 'month_09' as const },
        { value: '10', labelKey: 'month_10' as const },
        { value: '11', labelKey: 'month_11' as const },
        { value: '12', labelKey: 'month_12' as const },
    ];

    const filteredPosts = useMemo(() => {
        let result = [...posts];

        if (filterYear !== 'all') {
            result = result.filter(p => p.deadline?.startsWith(filterYear));
        }

        if (filterMonth !== 'all') {
            result = result.filter(p => {
                if (!p.deadline) return false;
                // deadline is YYYY-MM-DD
                return p.deadline.substring(5, 7) === filterMonth;
            });
        }

        if (filterWeek !== 'all') {
            result = result.filter(p => {
                if (!p.deadline) return false;
                const d = parseISO(p.deadline);
                return getWeekOfMonth(d).toString() === filterWeek;
            });
        }

        if (assignedToMe && currentUserProfile) {
            const userName = (currentUserProfile.name || '').trim().toLowerCase();
            const userEmail = (currentUserProfile.email || '').trim().toLowerCase();
            const userEmailPrefix = userEmail.split('@')[0];
            result = result.filter(p => {
                if (!p.pic || p.pic === 'Unassigned') return false;
                const picLower = p.pic.trim().toLowerCase();
                return picLower === userName || picLower === userEmail || picLower === userEmailPrefix;
            });
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(p => 
                (p.idea && p.idea.toLowerCase().includes(q))
            );
        }

        return result;
    }, [posts, filterYear, filterMonth, filterWeek, assignedToMe, currentUser, currentUserProfile, searchQuery]);

    // If a highlight_post is active, override all filters to show only that post
    const displayedPosts = useMemo(() => {
        if (highlightPostId) {
            return posts.filter(p => p.id === highlightPostId);
        }
        return filteredPosts;
    }, [highlightPostId, posts, filteredPosts]);

    const highlightedPostTitle = highlightPostId
        ? posts.find(p => p.id === highlightPostId)?.idea
        : null;

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
        <div className="flex flex-col w-full flex-1 min-h-0">
            {/* Sticky Header Wrapper */}
            <div className="flex-none bg-[#F4F2ED] dark:bg-[#1a141e] pt-2 pb-4 sm:pt-4 sm:pb-6 -mx-4 px-4 sm:-mx-8 sm:px-8 z-40 border-b border-border-subtle dark:border-gray-800 shadow-sm mb-4">
                {/* TopBar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 flex-shrink-0">
                {/* Breadcrumb */}
                <div className="flex justify-start">
                    <nav className="flex items-center gap-1.5 text-sm">
                        <span className="text-text-muted font-medium">ManaoHQ</span>
                        <span className="material-symbols-outlined text-border-subtle text-[16px]">chevron_right</span>
                        <span className="text-text-main dark:text-gray-100 font-bold">{t.content_hub}</span>
                    </nav>
                </div>

                {/* View Switcher */}
                <div className="flex justify-center">
                    <div className="flex items-center bg-surface-white dark:bg-gray-900 border border-border-subtle rounded-xl p-1 shadow-sm gap-0.5 transition-colors">
                        {viewOptions.map(({ view, icon, labelKey }) => (
                            <button
                                key={view}
                                onClick={() => setContentView(view)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${contentView === view
                                    ? 'bg-[#e6f0f5] dark:bg-primary/20 text-primary shadow-sm'
                                    : 'text-text-muted hover:text-text-main dark:hover:text-gray-200 hover:bg-background-light dark:hover:bg-gray-800'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-[16px]">{icon}</span>
                                {t[labelKey]}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-start md:justify-end gap-2">
                    {!isMember && contentView === 'table' && (
                        <button
                            onClick={() => setIsSelectionMode(!isSelectionMode)}
                            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl shadow-sm transition-all duration-200 border ${isSelectionMode ? 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20' : 'bg-surface-white dark:bg-gray-800 hover:bg-background-light dark:hover:bg-gray-700 text-text-main dark:text-gray-100 border-border-subtle dark:border-gray-700'}`}
                        >
                            <span className="material-symbols-outlined text-[20px]">checklist</span>
                            {isSelectionMode ? 'Batal Pilih' : 'Pilih Massal'}
                        </button>
                    )}
                    {isOwner && (
                        <>
                            <button
                                onClick={() => setIsBulkInsertOpen(true)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-surface-white dark:bg-gray-800 hover:bg-background-light dark:hover:bg-gray-700 text-text-main dark:text-gray-100 border border-border-subtle dark:border-gray-700 text-sm font-bold rounded-xl shadow-sm transition-all duration-200"
                            >
                                <span className="material-symbols-outlined text-[20px]">library_add</span>
                                Tambah Template
                            </button>
                            <button
                                onClick={() => openDrawer()}
                                className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-xl shadow-sm transition-all duration-200"
                            >
                                <span className="material-symbols-outlined text-[20px]">add</span>
                                {t.content_new_post}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 flex-shrink-0">
                {/* Left: Time Filters */}
                <div className="flex items-center justify-start shrink-0">
                    <div className="flex items-center gap-2 bg-surface-white dark:bg-gray-900 border border-border-subtle rounded-xl p-1.5 shadow-sm transition-colors">
                        <div className="flex items-center gap-2 px-2 text-text-muted border-r border-border-subtle">
                            <span className="material-symbols-outlined text-[18px]">filter_list</span>
                        </div>

                        <select
                            value={filterYear}
                            onChange={(e) => setContentFilterYear(e.target.value)}
                            className="text-sm font-medium bg-transparent text-text-main dark:text-gray-200 focus:outline-none cursor-pointer hover:text-primary px-1"
                        >
                            <option value="all">{t.content_year}</option>
                            {availableYears.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>

                        <div className="w-px h-4 bg-border-subtle" />

                        <select
                            value={filterMonth}
                            onChange={(e) => setContentFilterMonth(e.target.value)}
                            className="text-sm font-medium bg-transparent text-text-main dark:text-gray-200 focus:outline-none cursor-pointer hover:text-primary px-1"
                        >
                            <option value="all">{t.content_month}</option>
                            {allMonths.map(m => (
                                <option key={m.value} value={m.value}>{t[m.labelKey]}</option>
                            ))}
                        </select>

                        <div className="w-px h-4 bg-border-subtle" />

                        <select
                            value={filterWeek}
                            onChange={(e) => setContentFilterWeek(e.target.value)}
                            className="text-sm font-medium bg-transparent text-text-main dark:text-gray-200 focus:outline-none cursor-pointer hover:text-primary px-1 pr-2"
                        >
                            <option value="all">{t.content_week}</option>
                            <option value="1">{t.content_week} 1</option>
                            <option value="2">{t.content_week} 2</option>
                            <option value="3">{t.content_week} 3</option>
                            <option value="4">{t.content_week} 4</option>
                            <option value="5">{t.content_week} 5</option>
                        </select>

                        {!isFilterDefault && (
                            <>
                                <div className="w-px h-4 bg-border-subtle" />
                                <button
                                    onClick={resetToToday}
                                    className="p-1.5 rounded-lg hover:bg-background-light dark:hover:bg-gray-800 text-primary transition-all"
                                    title={t.calendar_today}
                                >
                                    <CalendarDays className="w-4 h-4" />
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Right Area: User Filters + Presence + Search */}
                <div className="flex items-center gap-3 justify-end flex-1 flex-wrap lg:flex-nowrap">
                    <WorkspacePresence />
                    <button
                        onClick={() => setContentAssignedToMe(!assignedToMe)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold border transition-all shadow-sm shrink-0 ${assignedToMe
                            ? 'bg-[#e6f0f5] dark:bg-primary/20 border-primary/30 text-primary ring-1 ring-primary/30'
                            : 'bg-surface-white dark:bg-gray-900 border-border-subtle text-text-muted hover:bg-background-light dark:hover:bg-gray-800 hover:text-text-main dark:hover:text-gray-100'
                            }`}
                    >
                        <span className="material-symbols-outlined text-[18px]">person</span>
                        {t.content_assigned_me}
                    </button>

                    {/* Search Input - Far Right */}
                    <div className="flex-1 w-full min-w-[200px] max-w-[320px]">
                        <div className="flex items-center gap-2 bg-surface-white dark:bg-gray-900 border border-border-subtle rounded-xl px-4 py-2 shadow-sm transition-all focus-within:ring-2 focus-within:ring-primary/50">
                            <span className="material-symbols-outlined text-[20px] text-text-muted">search</span>
                            <input 
                                type="text" 
                                placeholder="Cari judul ide..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-transparent border-none outline-none text-sm w-full text-text-main dark:text-gray-200 placeholder-gray-400"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="text-text-muted hover:text-text-main bg-gray-100 dark:bg-gray-800 rounded-full p-0.5 transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Highlight Filter Banner */}
            {highlightPostId && (
                <div className="flex items-center justify-between px-4 py-3 mb-4 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-xl">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-[20px]">filter_alt</span>
                        <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                            {t.content_showing_post} <span className="font-bold">{highlightedPostTitle || 'Unknown'}</span>
                        </p>
                    </div>
                    <button
                        onClick={clearHighlight}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 hover:bg-indigo-200 dark:hover:bg-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                        {t.content_show_all}
                    </button>
                </div>
            )}
            </div>

            {/* Content area */}
            <div className="w-full flex-1 flex flex-col min-h-0 -mx-4 px-4 sm:-mx-8 sm:px-8 pb-4">
                {contentView === 'table' && <TableView posts={displayedPosts} isSelectionMode={isSelectionMode} setIsSelectionMode={setIsSelectionMode} />}
                {contentView === 'kanban' && <KanbanView posts={displayedPosts} />}
                {contentView === 'calendar' && <CalendarView posts={displayedPosts} />}
            </div>

            {/* Bulk Insert Modal */}
            {isBulkInsertOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={() => !isInserting && setIsBulkInsertOpen(false)} />
                    <div className="bg-surface-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle/50 dark:border-gray-800">
                            <h3 className="text-lg font-bold text-text-main dark:text-white">Tambah Template</h3>
                            <button onClick={() => !isInserting && setIsBulkInsertOpen(false)} className="text-text-muted hover:text-text-main dark:hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-text-main dark:text-gray-200 mb-2">
                                    Berapa kolom yang mau diinsert?
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="50"
                                    value={bulkInsertCount}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setBulkInsertCount(val === '' ? '' : parseInt(val));
                                    }}
                                    className="w-full px-4 py-2 bg-surface-white dark:bg-gray-800 border border-border-subtle dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-text-main dark:text-white"
                                    disabled={isInserting}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text-main dark:text-gray-200 mb-2">
                                    Mulai dari Tanggal Post
                                </label>
                                <input
                                    type="date"
                                    value={bulkInsertStartDate}
                                    onChange={(e) => setBulkInsertStartDate(e.target.value)}
                                    className="w-full px-4 py-2 bg-surface-white dark:bg-gray-800 border border-border-subtle dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-text-main dark:text-white"
                                    disabled={isInserting}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text-main dark:text-gray-200 mb-2">
                                    Jeda Deadline (H-?)
                                </label>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm text-text-muted font-medium bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-xl">H-</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="30"
                                        value={bulkInsertDeadlineOffset}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setBulkInsertDeadlineOffset(val === '' ? '' : parseInt(val));
                                        }}
                                        className="flex-1 px-4 py-2 bg-surface-white dark:bg-gray-800 border border-border-subtle dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-text-main dark:text-white"
                                        disabled={isInserting}
                                    />
                                </div>
                                <p className="text-xs text-text-muted mt-1.5 ml-1">Deadline akan diset {bulkInsertDeadlineOffset || 0} hari sebelum Post Date.</p>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                            <button
                                onClick={() => setIsBulkInsertOpen(false)}
                                disabled={isInserting}
                                className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-main dark:text-gray-300 dark:hover:text-white disabled:opacity-50"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleBulkInsertSubmit}
                                disabled={isInserting}
                                className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                            >
                                {isInserting && <RotateCcw className="w-4 h-4 animate-spin" />}
                                {isInserting ? 'Menambahkan...' : 'Tambah'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <PostDrawer />
        </div>
    );
}
