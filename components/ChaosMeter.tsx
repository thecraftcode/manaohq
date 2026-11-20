'use client';

import { useMemo } from 'react';
import { useStorePersistent } from '@/store/useStorePersistent';
import { parseISO, isValid, differenceInDays, isSameMonth } from 'date-fns';
import { useT } from '@/lib/i18n';

interface ScoreTheme {
    color: string;
    label: string;
    textColor: string;
    bgAccent: string;
    emoji: string;
}

function getTheme(score: number): ScoreTheme {
    if (score <= 30) return {
        color: '#4F86C6',
        label: 'chaos_zen',
        textColor: 'text-[#4F86C6]',
        bgAccent: 'bg-[#4F86C6]/10',
        emoji: '🧘',
    };
    if (score <= 70) return {
        color: '#F59E0B',
        label: 'chaos_commanding',
        textColor: 'text-amber-500',
        bgAccent: 'bg-amber-500/10',
        emoji: '⚡',
    };
    return {
        color: '#EF4444',
        label: 'Total Chaos',
        textColor: 'text-red-500',
        bgAccent: 'bg-red-500/10',
        emoji: '🔥',
    };
}

/** Half-doughnut SVG gauge */
function GaugeArc({ score, color }: { score: number; color: string }) {
    const size = 200;
    const strokeWidth = 14;
    const r = (size - strokeWidth) / 2;
    const cx = size / 2;
    const cy = size / 2;

    // Semi-circle: from 180° to 0° (left to right along the top)
    const circumference = Math.PI * r; // half-circle circumference
    const progress = (Math.min(score, 100) / 100) * circumference;
    const dashOffset = circumference - progress;

    return (
        <svg
            width={size}
            height={size / 2 + strokeWidth}
            viewBox={`0 0 ${size} ${size / 2 + strokeWidth}`}
            className="overflow-visible"
        >
            {/* Track (background arc) */}
            <path
                d={`M ${strokeWidth / 2} ${cy} A ${r} ${r} 0 0 1 ${size - strokeWidth / 2} ${cy}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                className="text-zinc-100 dark:text-zinc-800"
            />
            {/* Progress arc */}
            <path
                d={`M ${strokeWidth / 2} ${cy} A ${r} ${r} 0 0 1 ${size - strokeWidth / 2} ${cy}`}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                className="transition-all duration-1000 ease-out"
            />
        </svg>
    );
}

export default function ChaosMeter() {
    const posts = useStorePersistent((state) => state.posts) || [];
    const today = new Date();
    const t = useT();

    const { chaosScore, urgentTasks, totalActive } = useMemo(() => {
        // Active = not in a 'done' state, AND deadline/postDate is in this current month
        const doneStatuses = ['Approved', 'Scheduled', 'Published', 'Shared'];
        const active = posts.filter((p) => {
            if (doneStatuses.includes(p.status || '')) return false;
            
            const dateStr = p.deadline || p.postDate;
            if (!dateStr) return false; // Ignore if no date
            
            const d = parseISO(dateStr);
            if (!isValid(d)) return false;
            
            // Only count tasks in the current month
            return isSameMonth(d, today);
        });

        // Urgent = from the active list, which ones are today or overdue
        const urgent = active.filter((p) => {
            const dateStr = p.deadline || p.postDate;
            const d = parseISO(dateStr!);
            return differenceInDays(d, today) <= 0;
        });

        const total = active.length;
        const score = total > 0 ? Math.round((urgent.length / total) * 100) : 0;

        return { chaosScore: score, urgentTasks: urgent.length, totalActive: total };
    }, [posts]);

    const theme = getTheme(chaosScore);

    return (
        <div className="bg-surface-white dark:bg-gray-900 rounded-2xl border border-border-subtle shadow-sm p-6 transition-colors w-full">
            <div className="flex flex-col md:flex-row items-center gap-8">
                {/* Gauge */}
                <div className="relative flex flex-col items-center">
                    <GaugeArc score={chaosScore} color={theme.color} />

                    {/* Score overlay — centered inside the gauge */}
                    <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
                        <span className={`text-5xl font-black tracking-tight ${theme.textColor}`}>
                            {chaosScore}
                            <span className="text-2xl font-bold opacity-60">%</span>
                        </span>
                        <span className={`text-sm font-bold mt-1 ${theme.textColor} flex items-center gap-1.5`}>
                            <span>{theme.emoji}</span>
                            {theme.label === 'chaos_zen' ? t.chaos_zen : theme.label === 'chaos_commanding' ? t.chaos_commanding : t.chaos_total}
                        </span>
                    </div>
                </div>

                {/* Stats */}
                <div className="flex-1 flex flex-col gap-4 min-w-0">
                    <div>
                        <h2 className="text-lg font-bold text-text-main dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-[20px]" style={{ color: theme.color }}>
                                monitor_heart
                            </span>
                            {t.chaos_title}
                        </h2>
                        <p className="text-xs text-text-muted mt-0.5">
                            {t.chaos_desc} (Khusus Bulan Ini)
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className={`rounded-xl p-3 ${theme.bgAccent} border border-transparent`}>
                            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">{t.chaos_urgent}</p>
                            <p className={`text-2xl font-black mt-1 ${theme.textColor}`}>{urgentTasks}</p>
                        </div>
                        <div className="rounded-xl p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-transparent">
                            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">{t.chaos_active}</p>
                            <p className="text-2xl font-black mt-1 text-text-main dark:text-white">{totalActive}</p>
                        </div>
                    </div>

                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
                        {t.chaos_score_desc}
                    </p>
                </div>
            </div>
        </div>
    );
}
