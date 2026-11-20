'use client';

import { StatusType, useStore } from '@/store/useStore';

interface StatusBadgeProps {
    status: StatusType;
    size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
    const statuses = useStore(s => s.statuses);
    const found = statuses?.find(s => s.name === status);
    const style = found ? { backgroundColor: found.color, color: '#ffffff' } : { backgroundColor: '#f1f5f9', color: '#64748b' };

    return (
        <span
            className={`inline-flex items-center rounded-full font-semibold shadow-sm whitespace-nowrap ${size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
                }`}
            style={style}
        >
            {found ? found.name : status || 'Unknown'}
        </span>
    );
}

interface PillarBadgeProps {
    pillar: string;
    size?: 'sm' | 'md';
}

export function PillarBadge({ pillar, size = 'sm' }: PillarBadgeProps) {
    const pillars = useStore(s => s.pillars);
    const found = pillars?.find(p => p.name === pillar);
    const style = found ? { backgroundColor: found.color, color: '#ffffff' } : { backgroundColor: '#f1f5f9', color: '#64748b' };

    return (
        <span
            className={`inline-flex items-center rounded-full font-semibold shadow-sm whitespace-nowrap ${size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
                }`}
            style={style}
        >
            {found ? found.name : pillar}
        </span>
    );
}

interface FunnelBadgeProps {
    funnel: string;
}

export function FunnelBadge({ funnel }: FunnelBadgeProps) {
    const funnels = useStore(s => s.funnels);
    const found = funnels?.find(f => f.name === funnel);
    const style = found ? { backgroundColor: found.color, color: '#ffffff' } : { backgroundColor: '#f1f5f9', color: '#64748b' };

    return (
        <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm whitespace-nowrap`}
            style={style}
        >
            {found ? found.name : funnel}
        </span>
    );
}
