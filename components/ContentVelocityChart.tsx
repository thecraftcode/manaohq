'use client';

import { useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts';
import { useStorePersistent } from '@/store/useStorePersistent';
import { useT } from '@/lib/i18n';

interface VelocityEntry {
    pic: string;
    avgDays: number;
    taskCount: number;
}

/** Custom tooltip — elegant, minimal */
const VelocityTooltip = ({ active, payload }: any) => {
    const t = useT();
    if (active && payload && payload.length) {
        const data = payload[0].payload as VelocityEntry;
        return (
            <div className="bg-white dark:bg-gray-900 px-4 py-3 rounded-xl shadow-xl border border-zinc-200/60 dark:border-white/10 min-w-[180px]">
                <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                    {t.velocity_title}
                </p>
                <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-zinc-600 dark:text-zinc-300">{t.velocity_tooltip_pic}</span>
                        <span className="text-sm font-bold text-zinc-900 dark:text-white">{data.pic}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-zinc-600 dark:text-zinc-300">{t.velocity_tooltip_avg}</span>
                        <span className="text-sm font-bold text-[#001F5B] dark:text-[#4F86C6]">{data.avgDays} {t.velocity_tooltip_days}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-zinc-100 dark:border-white/5 pt-1.5">
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">{t.velocity_tooltip_completed}</span>
                        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{data.taskCount}</span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

export default function ContentVelocityChart() {
    const posts = useStorePersistent((state) => state.posts) || [];
    const t = useT();

    const velocityData = useMemo<VelocityEntry[]>(() => {
        // Filter published/done posts that have both created_at and postDate, and a PIC
        const doneStatuses = ['Approved', 'Scheduled', 'Published', 'Shared'];
        const completed = posts.filter(
            (p) =>
                doneStatuses.includes(p.status || '') &&
                p.pic &&
                p.pic.trim() !== '' &&
                p.pic !== 'Unassigned' &&
                p.created_at &&
                p.postDate
        );

        // Group by PIC
        const picMap = new Map<string, number[]>();

        for (const post of completed) {
            const createdStamp = post.created_at ? new Date(post.created_at).getTime() : NaN;
            // Use completedAt as the exact completion time, fallback to postDate for backward compatibility
            const doneDateStr = post.completedAt || post.postDate;
            const doneStamp = doneDateStr ? new Date(doneDateStr).getTime() : NaN;

            if (isNaN(createdStamp) || isNaN(doneStamp)) continue;

            const diffMs = doneStamp - createdStamp;
            const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));

            const pic = post.pic!.trim();
            if (!picMap.has(pic)) picMap.set(pic, []);
            picMap.get(pic)!.push(diffDays);
        }

        // Calculate averages
        const result: VelocityEntry[] = [];
        for (const [pic, days] of picMap) {
            const avg = Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10;
            result.push({ pic, avgDays: avg, taskCount: days.length });
        }

        // Sort by avg days descending (slowest first)
        return result.sort((a, b) => b.avgDays - a.avgDays);
    }, [posts]);

    if (velocityData.length === 0) {
        return (
            <div className="bg-surface-white dark:bg-gray-900 rounded-2xl border border-border-subtle shadow-sm p-6 transition-colors w-full">
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-[#001F5B]/10 dark:bg-[#4F86C6]/20 w-10 h-10 rounded-xl flex items-center justify-center">
                        <span className="material-symbols-outlined text-[#001F5B] dark:text-[#4F86C6] text-[20px]">speed</span>
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-text-main dark:text-white">{t.velocity_title}</h2>
                        <p className="text-xs text-text-muted">{t.velocity_desc}</p>
                    </div>
                </div>
                <div className="py-12 text-center">
                    <span className="material-symbols-outlined text-4xl text-zinc-300 dark:text-zinc-600 mb-2">bar_chart</span>
                    <p className="text-sm text-text-muted font-medium mt-2">
                        {t.velocity_no_tasks}
                    </p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                        {t.velocity_assign_pic}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-surface-white dark:bg-gray-900 rounded-2xl border border-border-subtle shadow-sm p-6 transition-colors w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="bg-[#001F5B]/10 dark:bg-[#4F86C6]/20 w-10 h-10 rounded-xl flex items-center justify-center">
                        <span className="material-symbols-outlined text-[#001F5B] dark:text-[#4F86C6] text-[20px]">speed</span>
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-text-main dark:text-white">{t.velocity_title}</h2>
                        <p className="text-xs text-text-muted">{t.velocity_desc}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 bg-[#001F5B]/5 dark:bg-[#4F86C6]/10 px-3 py-1.5 rounded-lg">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#001F5B] dark:bg-[#4F86C6]" />
                    <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">{t.velocity_avg_days}</span>
                </div>
            </div>

            {/* Chart */}
            <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={velocityData}
                        layout="vertical"
                        margin={{ top: 8, right: 32, bottom: 8, left: 0 }}
                        barCategoryGap="25%"
                    >
                        <XAxis
                            type="number"
                            stroke="#94a3b8"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => `${v}h`}
                        />
                        <YAxis
                            dataKey="pic"
                            type="category"
                            stroke="#94a3b8"
                            fontSize={12}
                            fontWeight={600}
                            tickLine={false}
                            axisLine={false}
                            width={100}
                        />
                        <Tooltip
                            content={<VelocityTooltip />}
                            cursor={{ fill: 'rgba(0,31,91,0.04)' }}
                        />
                        <Bar
                            dataKey="avgDays"
                            radius={[0, 6, 6, 0]}
                            maxBarSize={32}
                            background={{ fill: '#f1f5f9' }}
                        >
                            {velocityData.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.avgDays > 7 ? '#EF4444' : entry.avgDays > 4 ? '#F59E0B' : '#001F5B'}
                                    className="transition-colors duration-200"
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
