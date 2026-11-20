'use client';

import { useStore } from '@/store/useStore';
import { useStorePersistent } from '@/store/useStorePersistent';
import { StatusBadge } from '../Badges';
import { format, differenceInDays, isValid, parseISO, subDays, startOfDay, endOfDay } from 'date-fns';
import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import WorkspacePresence from '../WorkspacePresence';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useT } from '@/lib/i18n';

const priorityColors: Record<string, string> = {
    High: 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-500/10',
    Medium: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10',
    Low: 'text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-500/10',
};

import { PresetRange } from '@/store/useStore';

import { generateDeterministicColor } from '@/lib/colors';

export default function DashboardView() {
    const { setActiveView, activeWorkspaceId, activeRole, currentUserProfile, statuses, pillars, funnels, contentTypes, teamMembers, updateDashboardCard, setDashboardPresetRange, setDashboardDateRange } = useStore();
    const posts = useStorePersistent((state) => state.posts);
    const dashboardCards = useStorePersistent((state) => state.dashboardCards) || [
        { slotId: 'slot1', category: 'special', value: 'drafts' },
        { slotId: 'slot2', category: 'special', value: 'briefs' },
        { slotId: 'slot3', category: 'status', value: 'Review' },
        { slotId: 'slot4', category: 'status', value: 'Scheduled' },
        { slotId: 'slot5', category: 'status', value: 'Published' }
    ];
    
    // Persistent Date Filters
    const presetRange = useStorePersistent((state) => state.dashboardPresetRange) || 'all';
    const dashboardDateRange = useStorePersistent((state) => state.dashboardDateRange);
    
    const dateRange: DateRange | undefined = useMemo(() => {
        if (!dashboardDateRange) return undefined;
        return {
            from: dashboardDateRange.from ? new Date(dashboardDateRange.from) : undefined,
            to: dashboardDateRange.to ? new Date(dashboardDateRange.to) : undefined
        };
    }, [dashboardDateRange]);

    const setDateRange = (range: DateRange | undefined) => {
        if (!range) {
            setDashboardDateRange(undefined);
        } else {
            setDashboardDateRange({
                from: range.from?.toISOString(),
                to: range.to?.toISOString()
            });
        }
    };
    const setPresetRange = setDashboardPresetRange;

    const t = useT();
    const isMember = activeRole === 'member';

    // Advanced Date Filters Setup
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [openCardSettingsId, setOpenCardSettingsId] = useState<string | null>(null);
    const [showCustomCalendar, setShowCustomCalendar] = useState(false);
    const [leftChartTab, setLeftChartTab] = useState<'pillar' | 'type'>('pillar');
    const [rightChartTab, setRightChartTab] = useState<'funnel' | 'pic'>('funnel');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close Dropdown on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
            if (openCardSettingsId) {
                if (!(event.target as Element).closest('.dashboard-card-dropdown') && !(event.target as Element).closest('.dashboard-card-dropdown-trigger')) {
                    setOpenCardSettingsId(null);
                }
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Helper to get exact Date ranges based on preset
    const getRanges = (preset: PresetRange) => {
        const today = new Date();
        let currentStart, currentEnd, prevStart, prevEnd;

        currentEnd = endOfDay(today);

        if (preset === '7days') {
            currentStart = startOfDay(subDays(today, 6)); // 7 days inclusive
            prevEnd = endOfDay(subDays(today, 7));
            prevStart = startOfDay(subDays(today, 13));
        } else if (preset === '14days') {
            currentStart = startOfDay(subDays(today, 13));
            prevEnd = endOfDay(subDays(today, 14));
            prevStart = startOfDay(subDays(today, 27));
        } else if (preset === '30days') {
            currentStart = startOfDay(subDays(today, 29));
            prevEnd = endOfDay(subDays(today, 30));
            prevStart = startOfDay(subDays(today, 59));
        } else if (preset === 'custom' && dateRange?.from && dateRange?.to) {
            currentStart = startOfDay(dateRange.from);
            currentEnd = endOfDay(dateRange.to);
            const diffDays = differenceInDays(currentEnd, currentStart);
            prevEnd = endOfDay(subDays(currentStart, 1));
            prevStart = startOfDay(subDays(prevEnd, diffDays));
        } else {
            // All Time or Custom w/o dates
            currentStart = new Date(2000, 0, 1);
            prevStart = new Date(1999, 0, 1);
            prevEnd = new Date(1999, 0, 1);
        }

        return {
            current: { start: format(currentStart, 'yyyy-MM-dd'), end: format(currentEnd, 'yyyy-MM-dd') },
            previous: { start: format(prevStart, 'yyyy-MM-dd'), end: format(prevEnd, 'yyyy-MM-dd') }
        };
    };

    const getPresetLabel = (preset: PresetRange) => {
        const labels: Record<PresetRange, string> = {
            '7days': t.dash_last_7,
            '14days': t.dash_last_14,
            '30days': t.dash_last_30,
            'custom': dateRange?.from && dateRange?.to ? `${format(dateRange.from, 'MMM dd')} - ${format(dateRange.to, 'MMM dd')}` : t.dash_custom,
            'all': t.dash_all_time
        };
        return labels[preset] || t.dash_custom;
    };

    // Dashboard Data Calculation (In-memory, Zero Latency)
    const currentData = useMemo(() => {
        if (!posts) return [];
        if (presetRange === 'all') return posts;

        const ranges = getRanges(presetRange);
        return posts.filter(p => {
            if (!p.postDate) return false;
            return p.postDate >= ranges.current.start && p.postDate <= ranges.current.end;
        });
    }, [posts, presetRange, dateRange]);

    const previousData = useMemo(() => {
        if (!posts || presetRange === 'all') return [];

        const ranges = getRanges(presetRange);
        return posts.filter(p => {
            if (!p.postDate) return false;
            return p.postDate >= ranges.previous.start && p.postDate <= ranges.previous.end;
        });
    }, [posts, presetRange, dateRange]);

    // Trend Calculator
    const calculateTrend = (current: number, previous: number) => {
        if (presetRange === 'all' || previous === 0) return { text: '-', color: 'text-slate-500 bg-slate-100 dark:bg-slate-800' };
        const diff = current - previous;
        const percent = ((diff / previous) * 100).toFixed(1);
        if (diff > 0) return { text: `+${percent}%`, color: 'text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/20' };
        if (diff < 0) return { text: `${percent}%`, color: 'text-rose-700 bg-rose-100 dark:text-rose-400 dark:bg-rose-500/20' };
        return { text: '0%', color: 'text-slate-500 bg-slate-100 dark:bg-slate-800' };
    };

    const getCardUITheme = (card: any) => {
        if (card.category === 'special') {
            if (card.value === 'drafts') return { label: t.dash_total_drafts, icon: 'edit_document', iconColor: 'text-primary dark:text-primary', bg: 'bg-primary/10 dark:bg-primary/20', customStyle: undefined, hexColor: undefined };
            if (card.value === 'briefs') return { label: t.dash_total_briefs, icon: 'description', iconColor: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10 dark:bg-purple-500/20', customStyle: undefined, hexColor: undefined };
        }
        
        let label = card.value;
        let icon = 'tag';
        let hexColor = undefined;
        
        if (card.category === 'status') {
            icon = 'task_alt';
            hexColor = statuses?.find(t => t.name === card.value)?.color;
        } else if (card.category === 'pillar') {
            icon = 'category';
            hexColor = pillars?.find(t => t.name === card.value)?.color;
        } else if (card.category === 'funnel') {
            icon = 'filter_alt';
            hexColor = funnels?.find(t => t.name === card.value)?.color;
        } else if (card.category === 'type') {
            icon = 'article';
            hexColor = contentTypes?.find(t => t.name === card.value)?.color;
        } else if (card.category === 'pic') {
            icon = 'person';
        }

        let customStyle = undefined;
        let dynamicIconColor = 'text-slate-600 dark:text-slate-400';
        let dynamicBg = 'bg-slate-500/10 dark:bg-slate-500/20';

        if (hexColor) {
            customStyle = { color: hexColor };
            dynamicIconColor = ''; 
        }

        const categoryLabels: any = { status: 'Status', pillar: 'Pillar', funnel: 'Funnel', type: 'Type', pic: 'PIC' };
        label = `${categoryLabels[card.category] || card.category}: ${card.value}`;

        return { label, icon, iconColor: dynamicIconColor, bg: dynamicBg, customStyle, hexColor };
    };

    const countCardMetric = (data: any[], card: any) => {
        return data.filter(p => {
            if (card.category === 'special') {
               if (card.value === 'drafts') return p.status?.toLowerCase() === 'idea' || p.status?.toLowerCase() === 'draft';
               if (card.value === 'briefs') return (p.script && p.script.trim() !== '') || (p.brief && p.brief.trim() !== '');
               return false;
            }
            if (!p) return false;
            if (card.category === 'status') return p.status?.toLowerCase() === card.value.toLowerCase() || (card.value.toLowerCase() === 'published' && p.status?.toLowerCase() === 'shared');
            if (card.category === 'pillar') return p.pillar === card.value;
            if (card.category === 'funnel') return p.funnel === card.value;
            if (card.category === 'type') return p.type === card.value;
            if (card.category === 'pic') return p.pic === card.value;
            return false;
        }).length;
    };

    const isOptionUsed = (category: string, value: string, currentSlotId: string) => {
        return dashboardCards.some(card => card.slotId !== currentSlotId && card.category === category && card.value === value);
    };

    const getButtonClass = (category: string, value: string, currentSlotId: string, isSelfSelected: boolean) => {
        if (isSelfSelected) {
            return 'px-3 py-1.5 bg-[#e6f0f5] dark:bg-primary/20 rounded-lg text-left text-sm font-bold text-primary flex items-center justify-between cursor-pointer';
        }
        const used = isOptionUsed(category, value, currentSlotId);
        return `px-3 py-1.5 rounded-lg text-left text-sm font-medium flex items-center justify-between group transition-colors cursor-pointer ${
            used
                ? 'text-text-muted dark:text-gray-400 hover:bg-[#e6f0f5]/50 hover:text-primary dark:hover:bg-primary/10 border hover:border-border-subtle border-transparent'
                : 'text-text-main dark:text-gray-200 hover:bg-background-light dark:hover:bg-gray-700 border hover:border-border-subtle border-transparent'
        }`;
    };

    const handleOptionClick = (slotId: string, category: any, value: string) => {
        const thisCard = dashboardCards.find(c => c.slotId === slotId);
        if (thisCard && thisCard.category === category && thisCard.value === value) {
            setOpenCardSettingsId(null);
            return;
        }

        const otherCard = dashboardCards.find(c => c.slotId !== slotId && c.category === category && c.value === value);
        if (otherCard && thisCard) {
            // Auto-swap feature
            updateDashboardCard(otherCard.slotId, thisCard.category, thisCard.value);
        }

        updateDashboardCard(slotId, category, value);
        setOpenCardSettingsId(null);
    };

    const metrics = dashboardCards.map(card => {
        const currentCount = countCardMetric(currentData, card);
        const previousCount = countCardMetric(previousData, card);
        const ui = getCardUITheme(card);

        return {
            ...card,
            ...ui,
            count: currentCount,
            trend: calculateTrend(currentCount, previousCount)
        };
    });

    // Prepare Distribution Data
    const pillarDist = useMemo(() => {
        if (!currentData || currentData.length === 0) return [];
        const dist: Record<string, { count: number, name: string, color: string }> = {};
        let total = 0;
        
        currentData.forEach(p => {
            if (!p.pillar) return;
            const pil = pillars?.find(t => t.name === p.pillar) || { name: p.pillar, color: '#94a3b8' };
            if (!dist[pil.name]) dist[pil.name] = { count: 0, name: pil.name, color: pil.color || '#94a3b8' };
            dist[pil.name].count++;
            total++;
        });

        return Object.values(dist).map(d => ({ ...d, total })).sort((a, b) => b.count - a.count);
    }, [currentData, pillars]);

    const typeDist = useMemo(() => {
        if (!currentData || currentData.length === 0) return [];
        const dist: Record<string, { count: number, name: string, color: string }> = {};
        let total = 0;
        
        currentData.forEach(p => {
            if (!p.type) return;
            const typ = contentTypes?.find(t => t.name === p.type) || { name: p.type, color: '#94a3b8' };
            if (!dist[typ.name]) dist[typ.name] = { count: 0, name: typ.name, color: typ.color || '#94a3b8' };
            dist[typ.name].count++;
            total++;
        });

        return Object.values(dist).map(d => ({ ...d, total })).sort((a, b) => b.count - a.count);
    }, [currentData, contentTypes]);

    const funnelDist = useMemo(() => {
        if (!currentData || currentData.length === 0) return [];
        const dist: Record<string, { count: number, name: string, color: string }> = {};
        let total = 0;
        
        currentData.forEach(p => {
            if (!p.funnel) return;
            const fun = funnels?.find(t => t.name === p.funnel) || { name: p.funnel, color: '#94a3b8' };
            if (!dist[fun.name]) dist[fun.name] = { count: 0, name: fun.name, color: fun.color || '#94a3b8' };
            dist[fun.name].count++;
            total++;
        });

        return Object.values(dist).map(d => ({ ...d, percentage: total > 0 ? (d.count / total) * 100 : 0 })).sort((a, b) => b.count - a.count);
    }, [currentData, funnels]);

    const picDist = useMemo(() => {
        if (!currentData || currentData.length === 0) return [];
        const dist: Record<string, { count: number, name: string, color: string }> = {};
        let total = 0;
        
        currentData.forEach(p => {
            if (!p.pic || p.pic === 'Unassigned') return;
            const picEntry = teamMembers?.find(t => t.name === p.pic);
            const picName = picEntry?.name || p.pic;
            const nodeColor = generateDeterministicColor(p.pic);
            
            if (!dist[picName]) dist[picName] = { count: 0, name: picName, color: nodeColor };
            dist[picName].count++;
            total++;
        });

        return Object.values(dist).map(d => ({ ...d, percentage: total > 0 ? (d.count / total) * 100 : 0 })).sort((a, b) => b.count - a.count);
    }, [currentData, teamMembers]);

    // Active Tab Data selections
    const activeLeftDist = leftChartTab === 'pillar' ? pillarDist : typeDist;
    const activeRightDist = rightChartTab === 'funnel' ? funnelDist : picDist;

    const today = new Date();

    if (posts === undefined) return null;

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

    const priorityTasks = posts
        .filter(p => {
            const statusLower = (p.status || '').toLowerCase();
            if (statusLower === 'published' || statusLower === 'shared') return false;
            // For team members, only show tasks assigned to them
            if (isMember && currentUserProfile) {
                const userName = (currentUserProfile.name || '').trim().toLowerCase();
                const userEmail = (currentUserProfile.email || '').trim().toLowerCase();
                const userEmailPrefix = userEmail.split('@')[0];
                if (!p.pic || p.pic === 'Unassigned') return false;
                const picLower = p.pic.trim().toLowerCase();
                if (picLower !== userName && picLower !== userEmail && picLower !== userEmailPrefix) return false;
            }

            // Only include tasks that have a deadline within the next 7 days (or 2 days overdue)
            const dateStr = p.deadline || p.postDate;
            if (!dateStr) return false;
            const deadlineDate = parseISO(dateStr);
            if (!isValid(deadlineDate)) return false;

            const daysDiff = differenceInDays(startOfDay(deadlineDate), startOfDay(today));
            return daysDiff >= -2 && daysDiff <= 7;
        })
        .sort((a, b) => {
            const timeA = parseISO(a.deadline || a.postDate!).getTime();
            const timeB = parseISO(b.deadline || b.postDate!).getTime();
            return timeA - timeB;
        })
        .slice(0, 5)
        .map(p => {
            const dateStr = p.deadline || p.postDate;
            const deadlineDate = parseISO(dateStr!);
            
            let priority = 'Low';
            let formattedDate = t.no_data;

            if (isValid(deadlineDate)) {
                const daysDiff = differenceInDays(startOfDay(deadlineDate), startOfDay(today));
                if (daysDiff < 0) priority = 'High'; // Overdue 
                else if (daysDiff <= 3) priority = 'High';
                else if (daysDiff <= 7) priority = 'Medium';

                formattedDate = format(deadlineDate, 'MMM dd');
            }

            return {
                id: p.id,
                title: p.idea,
                due: formattedDate,
                status: p.status,
                priority
            };
        });

    return (
        <div className="flex flex-col gap-10">
            <style dangerouslySetInnerHTML={{
                __html: `
                .rdp {
                    --rdp-color-focus-dark: #0f172a;
                    --rdp-color-focus-light: #e2e8f0;
                    margin: 0;
                }
                .rdp-day_selected, .rdp-day_selected:focus-visible, .rdp-day_selected:hover {
                    background-color: #0f172a !important;
                    color: white !important;
                }
                .dark .rdp-day_selected, .dark .rdp-day_selected:focus-visible, .dark .rdp-day_selected:hover {
                    background-color: #4AA4F1 !important;
                    color: #fff !important;
                }
                .rdp-day_selected.rdp-day_range_middle {
                    background-color: #f1f5f9 !important;
                    color: #0f172a !important;
                }
                .dark .rdp-day_selected.rdp-day_range_middle {
                    background-color: rgba(74, 164, 241, 0.2) !important;
                    color: #fff !important;
                }
                .rdp-root {
                    font-size: 0.8rem;
                }
                .rdp-cell {
                    padding: 0 !important;
                }
                .rdp-day {
                    width: 1.35rem;
                    height: 1.35rem;
                    border-radius: 9999px;
                }
                .rdp-button:hover:not([disabled]):not(.rdp-day_selected) {
                    background-color: #f1f5f9;
                }
                .dark .rdp-button:hover:not([disabled]):not(.rdp-day_selected) {
                    background-color: #334155;
                }
            `}} />
            {/* Header section similar to Stitch design */}
            <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                <div className="flex flex-col gap-1">
                    <h2 className="text-4xl font-extrabold text-text-main dark:text-gray-100 tracking-tight">{t.dash_title}</h2>
                    <p className="text-text-muted text-base font-medium">{t.dash_subtitle}</p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                    <WorkspacePresence />

                    {/* Advanced Pattern Date Filter Dropdown */}
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => {
                                setIsDropdownOpen(!isDropdownOpen);
                                if (!isDropdownOpen) {
                                    setShowCustomCalendar(presetRange === 'custom');
                                }
                            }}
                            className="flex items-center gap-2 bg-surface-white dark:bg-gray-800 border border-border-subtle hover:border-border-strong text-text-main dark:text-gray-200 px-4 py-2 rounded-xl h-10 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                            <CalendarIcon className="w-4 h-4 text-text-muted" />
                            <span className="text-sm font-semibold whitespace-nowrap">{getPresetLabel(presetRange)}</span>
                            <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isDropdownOpen && (
                            <div className={`absolute top-full right-0 mt-2 bg-surface-white dark:bg-gray-800 border border-border-subtle rounded-xl shadow-lg z-50 overflow-hidden flex flex-col ${!showCustomCalendar ? 'w-48' : 'w-auto min-w-[200px]'}`}>
                                {!showCustomCalendar ? (
                                    <div className="py-1">
                                        {(["7days", "14days", "30days", "all", "custom"] as PresetRange[]).map((preset) => (
                                            <button
                                                key={preset}
                                                onClick={() => {
                                                    if (preset === 'custom') {
                                                        setShowCustomCalendar(true);
                                                    } else {
                                                        setPresetRange(preset);
                                                        setIsDropdownOpen(false);
                                                    }
                                                }}
                                                className={`w-full text-center px-4 py-2 text-sm transition-colors ${presetRange === preset && preset !== 'custom'
                                                    ? 'bg-[#e6f0f5] dark:bg-primary/20 text-primary font-bold'
                                                    : 'text-text-main dark:text-gray-200 hover:bg-background-light dark:hover:bg-gray-700/50'}`}
                                            >
                                                {preset === 'custom' ? t.dash_custom : getPresetLabel(preset)}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-2 bg-surface-white dark:bg-gray-800 flex flex-col items-center">
                                        <div className="relative flex items-center justify-center w-full mb-2 h-6">
                                            <button
                                                onClick={() => setShowCustomCalendar(false)}
                                                className="absolute left-0 p-1 text-text-muted hover:text-primary hover:bg-background-light dark:hover:bg-gray-700 rounded transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                                            </button>
                                            <span className="text-xs font-bold text-text-main dark:text-gray-200 text-center">{t.dash_custom}</span>
                                        </div>
                                        <DayPicker
                                            mode="range"
                                            selected={dateRange}
                                            onSelect={setDateRange}
                                            className="font-sans text-text-main dark:text-gray-200"
                                        />
                                        <div className="flex justify-end w-full mt-3">
                                            <button
                                                onClick={() => {
                                                    setPresetRange('custom');
                                                    setIsDropdownOpen(false);
                                                }}
                                                className="px-4 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-hover transition-colors shadow-sm"
                                            >
                                                {t.dash_apply_range}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Stats Grid */}
            {!posts ? (
                <div className="py-20 text-center opacity-50">
                    <span className="material-symbols-outlined animate-spin text-4xl text-primary">sync</span>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {metrics.map((m) => (
                            <div
                                key={m.slotId}
                                className="relative bg-surface-white dark:bg-gray-900 rounded-2xl p-6 border border-border-subtle flex flex-col gap-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
                            >
                                <div className="flex items-center justify-between">
                                    <div className={`w-10 h-10 rounded-full ${m.bg} flex items-center justify-center ${m.iconColor}`} style={m.customStyle}>
                                        <span className="material-symbols-outlined">{m.icon}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${m.trend.color}`}>
                                            {m.trend.text}
                                        </span>
                                        <button 
                                            onClick={() => setOpenCardSettingsId(openCardSettingsId === m.slotId ? null : m.slotId)}
                                            className="dashboard-card-dropdown-trigger text-text-muted hover:text-text-main transition-colors"
                                            title="Configure Card"
                                        >
                                            <span className="material-symbols-outlined text-[20px]">more_vert</span>
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-text-muted dark:text-gray-400 text-sm font-semibold uppercase tracking-wider mb-1 truncate" title={m.label}>{m.label}</p>
                                    <p className="text-3xl font-bold text-text-main dark:text-white">{m.count}</p>
                                </div>

                                {/* Card Customization Popover */}
                                {openCardSettingsId === m.slotId && (
                                    <div className="absolute top-14 right-4 w-56 bg-surface-white dark:bg-gray-800 border border-border-subtle rounded-xl shadow-xl z-50 dashboard-card-dropdown text-left text-sm max-h-[300px] overflow-y-auto flex flex-col p-1">
                                        <div className="sticky top-0 bg-surface-white dark:bg-gray-800 px-3 py-2 border-b border-border-subtle/50 font-bold text-text-main dark:text-gray-200 text-xs uppercase tracking-wider mb-1 z-10 backdrop-blur-md">
                                            Select Metric
                                        </div>

                                        <div className="px-3 py-1 text-[10px] font-bold text-text-muted mt-1 uppercase">Custom</div>
                                        <button onClick={() => handleOptionClick(m.slotId, 'special', 'drafts')} className={getButtonClass('special', 'drafts', m.slotId, m.category === 'special' && m.value === 'drafts')}>
                                            <span className="truncate">Total Drafts</span>
                                            {m.category === 'special' && m.value === 'drafts' ? (
                                                <span className="material-symbols-outlined text-[14px] text-primary">check</span>
                                            ) : isOptionUsed('special', 'drafts', m.slotId) ? (
                                                <span className="material-symbols-outlined text-[14px] opacity-0 group-hover:opacity-100 transition-opacity">swap_horiz</span>
                                            ) : null}
                                        </button>
                                        <button onClick={() => handleOptionClick(m.slotId, 'special', 'briefs')} className={getButtonClass('special', 'briefs', m.slotId, m.category === 'special' && m.value === 'briefs')}>
                                            <span className="truncate">Total Briefs</span>
                                            {m.category === 'special' && m.value === 'briefs' ? (
                                                <span className="material-symbols-outlined text-[14px] text-primary">check</span>
                                            ) : isOptionUsed('special', 'briefs', m.slotId) ? (
                                                <span className="material-symbols-outlined text-[14px] opacity-0 group-hover:opacity-100 transition-opacity">swap_horiz</span>
                                            ) : null}
                                        </button>

                                        {statuses && statuses.length > 0 && (
                                            <>
                                                <div className="px-3 py-1 text-[10px] font-bold text-text-muted mt-2 uppercase">Status</div>
                                                {statuses.map(s => (
                                                    <button key={`status-${s.name}`} onClick={() => handleOptionClick(m.slotId, 'status', s.name)} className={getButtonClass('status', s.name, m.slotId, m.category === 'status' && m.value === s.name)}>
                                                        <span className="truncate">{s.name}</span>
                                                        {m.category === 'status' && m.value === s.name ? (
                                                            <span className="material-symbols-outlined text-[14px] text-primary">check</span>
                                                        ) : isOptionUsed('status', s.name, m.slotId) ? (
                                                            <span className="material-symbols-outlined text-[14px] opacity-0 group-hover:opacity-100 transition-opacity">swap_horiz</span>
                                                        ) : null}
                                                    </button>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Analytics Section */}
                    {posts.length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
                            {/* Left Chart */}
                            <div className="bg-surface-white dark:bg-gray-900 border border-border-subtle rounded-2xl p-6 shadow-sm flex flex-col">
                                <div className="flex items-center justify-between gap-2 mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">donut_large</span>
                                        <h3 className="text-lg font-bold text-text-main dark:text-gray-100 uppercase tracking-wide">Composition</h3>
                                    </div>
                                    <div className="flex bg-background-light dark:bg-gray-800 p-1 rounded-lg">
                                        <button 
                                            onClick={() => setLeftChartTab('pillar')}
                                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${leftChartTab === 'pillar' ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' : 'text-text-muted hover:text-text-main'} `}
                                        >
                                            Pillar
                                        </button>
                                        <button 
                                            onClick={() => setLeftChartTab('type')}
                                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${leftChartTab === 'type' ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' : 'text-text-muted hover:text-text-main'} `}
                                        >
                                            Type
                                        </button>
                                    </div>
                                </div>
                                
                                {activeLeftDist.length === 0 ? (
                                    <div className="flex-1 flex items-center justify-center min-h-[200px] text-text-muted text-sm italic">
                                        No data available for this range
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-8">
                                        <div className="h-[200px] w-[200px] flex-shrink-0 relative flex items-center justify-center">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={activeLeftDist}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={80}
                                                        paddingAngle={2}
                                                        dataKey="count"
                                                        stroke="none"
                                                    >
                                                        {activeLeftDist.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip 
                                                        formatter={(value: any, name: any, props: any) => [`${value} posts (${((value / props.payload.total) * 100).toFixed(1)}%)`, name]}
                                                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                <span className="text-2xl font-bold text-text-main dark:text-white">{activeLeftDist.reduce((acc, curr) => acc + curr.count, 0)}</span>
                                                <span className="text-[10px] uppercase font-bold text-text-muted">Posts</span>
                                            </div>
                                        </div>
                                        
                                        <div className="flex-1 w-full flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                            {activeLeftDist.map((pil, idx) => (
                                                <div key={pil.name} className="flex items-center justify-between p-2 rounded-lg hover:bg-background-light dark:hover:bg-gray-800 transition-colors">
                                                    <div className="flex items-center gap-2 truncate">
                                                        <div className="w-3 h-3 flex-shrink-0 rounded-full" style={{ backgroundColor: pil.color }} />
                                                        <span className="text-sm font-medium text-text-main dark:text-gray-200 truncate" title={pil.name}>{pil.name}</span>
                                                    </div>
                                                    <span className="text-sm font-bold text-text-muted pl-2">{pil.count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right Chart */}
                            <div className="bg-surface-white dark:bg-gray-900 border border-border-subtle rounded-2xl p-6 shadow-sm flex flex-col">
                                <div className="flex items-center justify-between gap-2 mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-emerald-500">filter_alt</span>
                                        <h3 className="text-lg font-bold text-text-main dark:text-gray-100 uppercase tracking-wide">Breakdown</h3>
                                    </div>
                                    <div className="flex bg-background-light dark:bg-gray-800 p-1 rounded-lg">
                                        <button 
                                            onClick={() => setRightChartTab('funnel')}
                                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${rightChartTab === 'funnel' ? 'bg-white dark:bg-gray-700 text-emerald-600 shadow-sm' : 'text-text-muted hover:text-text-main'} `}
                                        >
                                            Funnel
                                        </button>
                                        <button 
                                            onClick={() => setRightChartTab('pic')}
                                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${rightChartTab === 'pic' ? 'bg-white dark:bg-gray-700 text-emerald-600 shadow-sm' : 'text-text-muted hover:text-text-main'} `}
                                        >
                                            PIC
                                        </button>
                                    </div>
                                </div>

                                {activeRightDist.length === 0 ? (
                                    <div className="flex-1 flex items-center justify-center min-h-[200px] text-text-muted text-sm italic">
                                        No data available for this range
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col justify-center gap-6">
                                        {/* Stacked Progress Bar */}
                                        <div className="w-full h-8 rounded-full overflow-hidden flex shadow-inner ring-1 ring-black/5 dark:ring-white/5 bg-gray-100 dark:bg-gray-800">
                                            {activeRightDist.map((fun) => (
                                                <div 
                                                    key={fun.name}
                                                    style={{ width: `${fun.percentage}%`, backgroundColor: fun.color }}
                                                    className="h-full relative group cursor-pointer border-r last:border-r-0 border-white/20 dark:border-black/20 hover:brightness-110 transition-all min-w-[2%]"
                                                    title={`${fun.name}: ${fun.percentage.toFixed(1)}%`}
                                                >
                                                </div>
                                            ))}
                                        </div>

                                        {/* Legend Grid */}
                                        <div className="grid grid-cols-2 gap-3 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                                            {activeRightDist.map((fun) => (
                                                <div key={fun.name} className="flex flex-col gap-1 p-3 rounded-xl bg-background-light dark:bg-gray-800 border border-transparent hover:border-border-subtle transition-colors">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2 truncate pr-2">
                                                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: fun.color }} />
                                                            <span className="text-sm font-bold text-text-main dark:text-gray-200 truncate" title={fun.name}>{fun.name}</span>
                                                        </div>
                                                        <span className="text-lg font-extrabold text-text-main dark:text-white leading-none">{fun.percentage.toFixed(0)}%</span>
                                                    </div>
                                                    <span className="text-[11px] font-medium text-text-muted">{fun.count} Posts</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Priority Tasks Table Block */}
                    <div className="bg-surface-white dark:bg-gray-900 border border-border-subtle rounded-2xl overflow-hidden shadow-sm">
                        <div className="px-6 py-5 border-b border-border-subtle/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-rose-500">warning</span>
                                <h3 className="text-lg font-bold text-text-main dark:text-gray-100">{t.dash_priority_tasks}</h3>
                            </div>
                            <button
                                onClick={() => setActiveView('content')}
                                className="text-primary text-sm font-bold hover:underline"
                            >
                                {t.dash_view_all}
                            </button>
                        </div>
                        <div className="divide-y divide-border-subtle/30">
                            {priorityTasks.map((task, i) => (
                                <div key={task.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 group transition-colors">
                                    <div className="flex items-center gap-4 flex-1">
                                        <span className="text-text-muted text-xs font-mono w-5">{String(i + 1).padStart(2, '0')}</span>
                                        <div className="flex flex-col">
                                            <span className="text-text-main dark:text-gray-100 font-bold text-sm">{task.title}</span>
                                            <span className="text-text-muted text-xs">{t.dash_due} {task.due}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${priorityColors[task.priority]} dark:bg-opacity-20`}>
                                            {task.priority}
                                        </span>
                                        <div className="w-24 flex justify-end">
                                            <StatusBadge status={task.status} />
                                        </div>
                                        <button className="text-text-muted hover:text-primary p-1 rounded-lg transition-colors ml-4">
                                            <span className="material-symbols-outlined text-[20px]">more_vert</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {priorityTasks.length === 0 && (
                                <div className="px-6 py-8 text-center text-slate-500 dark:text-slate-400 text-sm font-medium">
                                    {t.dash_no_priority}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
