'use client';

import { useStore, StatusType, Post } from '@/store/useStore';
import { useStorePersistent } from '@/store/useStorePersistent';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useT } from '@/lib/i18n';
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    parseISO,
} from 'date-fns';

const statusColors: Record<StatusType, string> = {
    idea: 'bg-blue-500',
    draft: 'bg-slate-500',
    'in progress': 'bg-cyan-500',
    review: 'bg-amber-500',
    approved: 'bg-green-500',
    published: 'bg-brand-500',
    scheduled: 'bg-indigo-500',
};

export default function CalendarView({ posts }: { posts: Post[] }) {
    const { openDrawer } = useStore();
    const t = useT();

    // State for calendar navigation
    const [currentDate, setCurrentDate] = useState(() => new Date());

    // Month Navigation
    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const goToToday = () => setCurrentDate(new Date());
    const isCurrentMonthShown = isSameMonth(currentDate, new Date());

    // Generate dates for the grid
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    // Start grid from the Monday of the week that monthStart falls in
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const dateFormat = "MMMM yyyy";

    // 7 Days of week: Mon -> Sun
    const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    const calendarDays = eachDayOfInterval({
        start: startDate,
        end: endDate
    });

    if (posts.length === 0 && posts !== undefined) {
        // Just waiting for hydration
    }

    return (
        <div className="bg-surface-white dark:bg-gray-900 rounded-2xl border border-border-subtle shadow-sm overflow-y-auto custom-scrollbar flex-1 min-h-0 flex flex-col transition-colors">
            {/* Calendar header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle/50 flex-shrink-0">
                <h3 className="font-bold text-text-main dark:text-gray-100 text-lg">{format(currentDate, dateFormat)}</h3>
                <div className="flex items-center gap-1 bg-background-light dark:bg-gray-800 p-1 rounded-xl border border-border-subtle">
                    <button
                        onClick={prevMonth}
                        className="p-1.5 rounded-lg hover:bg-surface-white dark:hover:bg-gray-700 hover:shadow-sm text-text-muted transition-all font-bold"
                    >
                        <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                    </button>
                    {!isCurrentMonthShown && (
                        <button
                            onClick={goToToday}
                            className="p-1.5 rounded-lg hover:bg-surface-white dark:hover:bg-gray-700 hover:shadow-sm text-primary transition-all"
                            title={t.calendar_today}
                        >
                            <CalendarDays className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={nextMonth}
                        className="p-1.5 rounded-lg hover:bg-surface-white dark:hover:bg-gray-700 hover:shadow-sm text-text-muted transition-all font-bold"
                    >
                        <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                    </button>
                </div>
            </div>

            {/* Day names */}
            <div className="grid grid-cols-7 border-b border-border-subtle bg-background-light/50 dark:bg-gray-900/50 flex-shrink-0">
                {daysOfWeek.map((d) => (
                    <div key={d} className="py-2.5 text-center text-[11px] font-bold text-text-muted uppercase tracking-wider">
                        {d}
                    </div>
                ))}
            </div>

            {/* Grid Cells */}
            <div className="grid grid-cols-7 auto-rows-fr">
                {calendarDays.map((day, i) => {
                    // Filter posts for this specific day
                    const dayPosts = posts.filter(p => {
                        try {
                            return isSameDay(parseISO(p.postDate), day);
                        } catch (e) {
                            // Fallback for badly formatted dates
                            return false;
                        }
                    });

                    const isCurrentMonth = isSameMonth(day, monthStart);
                    const isToday = isSameDay(day, new Date());

                    return (
                        <div
                            key={day.toString()}
                            className={`min-h-[120px] p-2 border-b border-r border-border-subtle/50 flex flex-col gap-1 transition-colors
                                ${!isCurrentMonth ? 'bg-background-light/50 dark:bg-gray-900/50' : 'hover:bg-background-light/30 dark:hover:bg-gray-800/30'}
                            `}
                        >
                            <div className="flex justify-end mb-1">
                                <span
                                    className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold
                                        ${isToday
                                            ? 'bg-primary text-white shadow-sm'
                                            : !isCurrentMonth
                                                ? 'text-border-subtle'
                                                : 'text-text-main'
                                        }
                                    `}
                                >
                                    {format(day, 'd')}
                                </span>
                            </div>

                            <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto no-scrollbar">
                                {dayPosts.slice(0, 3).map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => openDrawer(p)}
                                        className="w-full text-left text-[11px] font-bold text-text-main dark:text-gray-100 bg-surface-white dark:bg-gray-800 border border-border-subtle rounded-md px-2 py-1.5 shadow-sm truncate hover:border-primary/50 hover:text-primary dark:hover:text-primary-hover hover:shadow transition-all group flex items-center gap-1.5"
                                    >
                                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusColors[p.status] || 'bg-border-subtle dark:bg-gray-600'}`} />
                                        <span className="truncate">{p.idea}</span>
                                    </button>
                                ))}
                                {dayPosts.length > 3 && (
                                    <button className="text-[10px] font-bold text-text-muted hover:text-primary px-1 py-0.5 mt-0.5 text-left transition-colors">
                                        +{dayPosts.length - 3} {t.calendar_more}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
