'use client';

import { Suspense, useEffect } from 'react';
import { useStore, ViewType } from '@/store/useStore';
import { useSearchParams } from 'next/navigation';
import DashboardView from './views/DashboardView';
import ContentHubView from './views/ContentHubView';
import AnalyticsView from './views/AnalyticsView';
import SettingsView from './views/SettingsView';
import IdeaBankView from './views/IdeaBankView';
import TagsManagerView from './views/TagsManagerView';

export default function MainCanvas() {
    const { activeView, setActiveView } = useStore();
    const searchParams = useSearchParams();

    // Sync URL tab parameter string to the Zustand activeView store
    useEffect(() => {
        const tab = searchParams.get('tab') as ViewType;
        if (tab && tab !== activeView) {
            setActiveView(tab);
        } else if (!tab && activeView !== 'dashboard') {
            // Default back to dashboard if no tab is specified and we aren't there
            setActiveView('dashboard');
        }
    }, [searchParams, setActiveView, activeView]);

    return (
        <main className={`flex-1 h-screen bg-background-light dark:bg-background-dark relative ${activeView === 'content' ? 'overflow-hidden flex flex-col' : 'overflow-auto'}`}>
            <div className={`mx-auto w-full flex flex-col ${activeView === 'content' ? 'max-w-full px-4 sm:px-8 pt-6 pb-2 flex-1 min-h-0' : 'max-w-[1200px] px-8 py-10 gap-10'}`}>
                <Suspense fallback={<div className="p-8 text-center text-text-muted">Loading...</div>}>
                    {activeView === 'dashboard' && <DashboardView />}
                    {activeView === 'content' && <ContentHubView />}
                    {activeView === 'ideabank' && <IdeaBankView />}
                    {activeView === 'analytics' && <AnalyticsView />}
                    {activeView === 'settings' && <SettingsView />}
                    {activeView === 'tags' && <TagsManagerView />}
                </Suspense>
            </div>
        </main>
    );
}
