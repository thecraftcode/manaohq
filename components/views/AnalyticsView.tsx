'use client';

import { useState } from 'react';

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

import {
    TrendingUp,
    TrendingDown,
    Eye,
    Users,
    Activity,
    Instagram,
    Youtube,
    Twitter,
    Linkedin
} from 'lucide-react';
import ContentVelocityChart from '../ContentVelocityChart';
import ChaosMeter from '../ChaosMeter';
import { useT } from '@/lib/i18n';

const chartData = [
    { date: 'Oct 01', views: 4000, reach: 2400 },
    { date: 'Oct 03', views: 4200, reach: 2500 },
    { date: 'Oct 05', views: 5100, reach: 3000 },
    { date: 'Oct 07', views: 4800, reach: 2800 },
    { date: 'Oct 09', views: 5600, reach: 3500 },
    { date: 'Oct 11', views: 5400, reach: 3300 },
    { date: 'Oct 13', views: 6200, reach: 3900 },
    { date: 'Oct 15', views: 7100, reach: 4500 },
    { date: 'Oct 17', views: 6800, reach: 4300 },
    { date: 'Oct 19', views: 7800, reach: 5100 },
    { date: 'Oct 21', views: 8200, reach: 5500 },
    { date: 'Oct 23', views: 8000, reach: 5300 },
    { date: 'Oct 25', views: 9500, reach: 6200 },
    { date: 'Oct 27', views: 10200, reach: 6800 },
    { date: 'Oct 29', views: 11000, reach: 7500 },
    { date: 'Oct 31', views: 12500, reach: 8200 },
];

const topPosts = [
    { id: 1, title: 'How to build a SaaS in 30 days', platform: Twitter, views: '124.5K', likes: '12.3K', er: '9.8%', color: 'text-sky-500' },
    { id: 2, title: 'Behind the scenes of our $1M ARR launch', platform: Youtube, views: '89.2K', likes: '8.4K', er: '9.4%', color: 'text-red-500' },
    { id: 3, title: '10 tools every founder needs in 2026', platform: Linkedin, views: '65.8K', likes: '1.2K', er: '1.8%', color: 'text-blue-600' },
    { id: 4, title: 'Day in the life of a bootstrapped founder', platform: Instagram, views: '45.1K', likes: '4.8K', er: '10.6%', color: 'text-pink-600' },
    { id: 5, title: 'Why we ditched our main product', platform: Twitter, views: '32.4K', likes: '3.1K', er: '9.5%', color: 'text-sky-500' },
];

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white dark:bg-agency-900 p-4 rounded-xl shadow-lg border border-brand-50 dark:border-agency-800 min-w-[150px]">
                <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold mb-2">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex justify-between items-center gap-4 mb-1 border-b border-paper dark:border-agency-800/50 pb-1 last:border-0 last:pb-0 last:mb-0">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.stroke }} />
                            <span className="text-slate-600 dark:text-brand-200 text-sm capitalize">{entry.name}</span>
                        </div>
                        <span className="text-agency-900 dark:text-white font-bold text-sm">
                            {(entry.value).toLocaleString()}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

type AnalyticsTab = 'operations' | 'performance';

export default function AnalyticsView() {
    const [activeTab, setActiveTab] = useState<AnalyticsTab>('operations');
    const t = useT();

    const tabs: { id: AnalyticsTab; label: string; icon: string }[] = [
        { id: 'operations', label: t.analytics_operations, icon: 'manufacturing' },
        { id: 'performance', label: t.analytics_performance, icon: 'monitoring' },
    ];

    return (
        <div className="w-full h-full flex flex-col gap-6">

            <div className="mb-0">
                <h1 className="text-2xl font-bold text-text-main dark:text-white">{t.analytics_title}</h1>
                <p className="text-text-muted mt-1 font-bold">{t.analytics_subtitle}</p>

                {/* Pill Tabs */}
                <div className="flex items-center gap-1.5 mt-5 bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-xl w-fit">
                    {tabs.map(({ id, label, icon }) => (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${activeTab === id
                                ? 'bg-[#001F5B] text-white shadow-sm'
                                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                                }`}
                        >
                            <span className="material-symbols-outlined text-[18px]">{icon}</span>
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Operations Tab ──────────────────────────────────────────── */}
            {activeTab === 'operations' && (
                <>
                    <ChaosMeter />
                    <ContentVelocityChart />
                </>
            )}

            {/* ── Performance Tab ─────────────────────────────────────────── */}
            {activeTab === 'performance' && (
                <>
                    {/* High-Level Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                        {/* Views */}
                        <div className="bg-surface-white dark:bg-gray-900 rounded-2xl border border-border-subtle shadow-sm p-6 transition-colors w-full">
                            <div className="flex items-center justify-between mb-4">
                                <div className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 w-12 h-12 rounded-xl flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[24px]">visibility</span>
                                </div>
                            </div>
                            <div>
                                <p className="text-text-muted text-sm font-bold uppercase tracking-wider mb-1">{t.analytics_total_views}</p>
                                <h3 className="text-3xl font-bold text-text-main dark:text-white">1.2M</h3>
                            </div>
                            <div className="mt-4 flex items-center gap-1 text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 w-fit px-2.5 py-1 rounded-lg">
                                <span className="material-symbols-outlined text-[16px]">trending_up</span>
                                <span>12.5% {t.analytics_vs_last_month}</span>
                            </div>
                        </div>

                        {/* Reach */}
                        <div className="bg-surface-white dark:bg-gray-900 rounded-2xl border border-border-subtle shadow-sm p-6 transition-colors w-full">
                            <div className="flex items-center justify-between mb-4">
                                <div className="bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 w-12 h-12 rounded-xl flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[24px]">group</span>
                                </div>
                            </div>
                            <div>
                                <p className="text-text-muted text-sm font-bold uppercase tracking-wider mb-1">{t.analytics_total_reach}</p>
                                <h3 className="text-3xl font-bold text-text-main dark:text-white">850K</h3>
                            </div>
                            <div className="mt-4 flex items-center gap-1 text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 w-fit px-2.5 py-1 rounded-lg">
                                <span className="material-symbols-outlined text-[16px]">trending_up</span>
                                <span>8.2% {t.analytics_vs_last_month}</span>
                            </div>
                        </div>

                        {/* Engagement */}
                        <div className="bg-surface-white dark:bg-gray-900 rounded-2xl border border-border-subtle shadow-sm p-6 transition-colors w-full">
                            <div className="flex items-center justify-between mb-4">
                                <div className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 w-12 h-12 rounded-xl flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[24px]">favorite</span>
                                </div>
                            </div>
                            <div>
                                <p className="text-text-muted text-sm font-bold uppercase tracking-wider mb-1">{t.analytics_avg_er}</p>
                                <h3 className="text-3xl font-bold text-text-main dark:text-white">4.8%</h3>
                            </div>
                            <div className="mt-4 flex items-center gap-1 text-sm font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 w-fit px-2.5 py-1 rounded-lg">
                                <span className="material-symbols-outlined text-[16px]">trending_down</span>
                                <span>-1.2% {t.analytics_vs_last_month}</span>
                            </div>
                        </div>
                    </div>

                    {/* Performance Over Time Chart */}
                    <div className="bg-surface-white dark:bg-gray-900 rounded-2xl border border-border-subtle shadow-sm p-6 transition-colors w-full">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-text-main dark:text-white">{t.analytics_perf_time}</h2>
                            <select className="bg-background-light dark:bg-gray-800 border border-border-subtle text-text-main dark:text-gray-200 text-sm rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold cursor-pointer">
                                <option>{t.analytics_last_30}</option>
                                <option>{t.analytics_this_quarter}</option>
                                <option>{t.analytics_this_year}</option>
                            </select>
                        </div>
                        <div className="h-[300px] w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="date"
                                        stroke="#94a3b8"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        dy={10}
                                    />
                                    <YAxis
                                        stroke="#94a3b8"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => `${value / 1000}k`}
                                        dx={-10}
                                    />
                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 2, strokeDasharray: '4 4' }} />
                                    <Line
                                        type="monotone"
                                        dataKey="views"
                                        name="Views"
                                        stroke="#4f46e5"
                                        strokeWidth={3}
                                        dot={false}
                                        activeDot={{ r: 6, fill: "#4f46e5", stroke: "#e0e7ff", strokeWidth: 4 }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="reach"
                                        name="Reach"
                                        stroke="#0d9488"
                                        strokeWidth={3}
                                        dot={false}
                                        activeDot={{ r: 6, fill: "#0d9488", stroke: "#ccfbf1", strokeWidth: 4 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Top Performing Posts */}
                    <div className="bg-surface-white dark:bg-gray-900 rounded-2xl border border-border-subtle shadow-sm overflow-hidden transition-colors w-full">
                        <div className="px-6 py-5 border-b border-border-subtle/50 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-text-main dark:text-white">{t.analytics_top_posts}</h2>
                        </div>
                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-background-light/50 dark:bg-gray-800/50 border-b border-border-subtle/50">
                                        <th className="py-4 px-6 text-xs font-bold text-text-muted uppercase tracking-wider">{t.analytics_post}</th>
                                        <th className="py-4 px-6 text-xs font-bold text-text-muted uppercase tracking-wider">{t.analytics_platform}</th>
                                        <th className="py-4 px-6 text-xs font-bold text-text-muted uppercase tracking-wider text-right">{t.analytics_views}</th>
                                        <th className="py-4 px-6 text-xs font-bold text-text-muted uppercase tracking-wider text-right">{t.analytics_likes}</th>
                                        <th className="py-4 px-6 text-xs font-bold text-text-muted uppercase tracking-wider text-right">{t.analytics_eng_rate}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-subtle/50 dark:divide-gray-800/50">
                                    {topPosts.map((post) => {
                                        const PlatformIcon = post.platform;
                                        return (
                                            <tr key={post.id} className="hover:bg-background-light/50 dark:hover:bg-gray-800/50 transition-colors group">
                                                <td className="py-4 px-6 text-sm font-bold text-text-main dark:text-gray-100">
                                                    {post.title}
                                                </td>
                                                <td className="py-4 px-6">
                                                    <div className={`p-2 rounded-xl bg-background-light w-fit ${post.color}`}>
                                                        <PlatformIcon className="w-4 h-4" />
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6 text-sm text-text-muted font-bold text-right">
                                                    {post.views}
                                                </td>
                                                <td className="py-4 px-6 text-sm text-text-muted font-bold text-right">
                                                    {post.likes}
                                                </td>
                                                <td className="py-4 px-6 text-sm font-bold text-primary dark:text-primary-hover text-right">
                                                    {post.er}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

        </div>
    );
}
