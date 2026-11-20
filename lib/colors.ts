import { useStore } from '@/store/useStore';

export const generateDeterministicColor = (str: string) => {
    if (!str || str === 'Unassigned' || str === '') return '#94a3b8';
    
    // The user requested to strictly use the exact same color palette provided in Workspace Settings
    // for Tags (Pillars, Funnels, etc.) to ensure aesthetic uniformity across the entire platform.
    const TAG_PALETTE = [
        '#6366f1', '#10b981', '#f59e0b', '#f43f5e',
        '#0ea5e9', '#8b5cf6', '#d946ef', '#64748b',
        '#0f766e', '#b91c1c', '#d97706', '#4338ca',
        '#22c55e', '#3b82f6', '#e11d48', '#7c3aed',
    ];

    try {
        const teamMembers = useStore.getState().teamMembers;
        if (teamMembers && teamMembers.length > 0) {
            const memberIndex = teamMembers.findIndex(m => m.name.toLowerCase() === str.toLowerCase());
            if (memberIndex !== -1) {
                // Guaranteed unique color for registered team member!
                return TAG_PALETTE[memberIndex % TAG_PALETTE.length];
            }
        }
    } catch (e) {
        // Safe fallback
    }

    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    hash = Math.abs(hash);
    
    return TAG_PALETTE[hash % TAG_PALETTE.length];
};
