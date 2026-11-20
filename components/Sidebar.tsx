'use client';

import { useStore, ViewType } from '@/store/useStore';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import NotificationDropdown from './NotificationDropdown';
import Image from 'next/image';
import { useT } from '@/lib/i18n';

const navItemKeys: { labelKey: 'nav_overview' | 'nav_content' | 'nav_ideabank' | 'nav_analytics'; view: ViewType; icon: string }[] = [
    { labelKey: 'nav_overview', view: 'dashboard', icon: 'grid_view' },
    { labelKey: 'nav_content', view: 'content', icon: 'description' },
    { labelKey: 'nav_ideabank', view: 'ideabank', icon: 'lightbulb' },
    { labelKey: 'nav_analytics', view: 'analytics', icon: 'bar_chart' },
];

const systemItemKeys: { labelKey: 'nav_settings'; view: ViewType; icon: string }[] = [
    { labelKey: 'nav_settings', view: 'settings', icon: 'settings' },
];

interface SidebarProps {
    minimal?: boolean;
}

export default function Sidebar({ minimal = false }: SidebarProps) {
    const { activeView, setActiveView, setMobileMenuOpen, currentUserProfile, fetchCurrentUserProfile, sidebarCollapsed, toggleSidebar } = useStore();
    const router = useRouter();
    const t = useT();
    const [hasPendingInvites, setHasPendingInvites] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifOpen, setNotifOpen] = useState(false);
    const notifBtnRef = useRef<HTMLButtonElement>(null);
    const notifPanelRef = useRef<HTMLDivElement>(null);
    const [panelTop, setPanelTop] = useState(0);

    useEffect(() => {
        if (!currentUserProfile) fetchCurrentUserProfile();
    }, [currentUserProfile, fetchCurrentUserProfile]);

    // Close notification popover when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                notifBtnRef.current && !notifBtnRef.current.contains(target) &&
                notifPanelRef.current && !notifPanelRef.current.contains(target)
            ) {
                setNotifOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Calculate panel position when opened
    useEffect(() => {
        if (notifOpen && notifBtnRef.current) {
            const rect = notifBtnRef.current.getBoundingClientRect();
            const sidebarRect = notifBtnRef.current.closest('aside')?.getBoundingClientRect();
            if (sidebarRect) {
                setPanelTop(rect.top - sidebarRect.top);
            }
        }
    }, [notifOpen]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    const handlePendingInviteChange = useCallback((count: number) => {
        setHasPendingInvites(count > 0);
    }, []);

    const handleUnreadCountChange = useCallback((count: number) => {
        setUnreadCount(count);
    }, []);

    const profileName = currentUserProfile?.name || 'Loading...';
    const rawRole = currentUserProfile?.role || 'Admin';
    const profileRole = rawRole.toLowerCase() === 'member' ? t.role_member : rawRole.toLowerCase() === 'owner' ? t.role_owner : t.role_admin;

    return (
        <aside className="w-full h-full bg-surface-white dark:bg-gray-900 border-r border-border-subtle flex flex-col flex-shrink-0 z-20 relative transition-all duration-300">
            {/* Logo Area */}
            <div className={`h-20 flex items-center ${sidebarCollapsed ? 'justify-center relative' : 'px-6 justify-between'} border-b border-border-subtle/30 transition-all`}>
                <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                    <div className="flex items-center justify-center shrink-0 w-8 h-8 rounded-lg bg-[#3E88B0] overflow-hidden relative shadow-sm">
                        <Image src="/logo-manao.svg" alt="ManaoHQ Logo" fill className="object-cover scale-125" />
                    </div>
                    {!sidebarCollapsed && (
                        <div className="flex flex-col justify-center">
                            <h1 className="text-text-main dark:text-white text-lg font-black leading-none tracking-tight">ManaoHQ</h1>
                            <p className="text-text-muted text-[7px] font-bold mt-1 uppercase tracking-wider leading-none">{t.sidebar_tagline}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Toggle Button in the vertical middle of the border */}
            <button
                onClick={toggleSidebar}
                className="hidden md:flex absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-6 items-center justify-center bg-white dark:bg-gray-800 border border-border-subtle rounded-full shadow-sm text-text-muted hover:text-primary hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors z-50"
            >
                <span className="material-symbols-outlined text-[16px]">
                    {sidebarCollapsed ? 'chevron_right' : 'chevron_left'}
                </span>
            </button>

            {/* Workspace Switcher */}
            {!minimal && !sidebarCollapsed && (
                <div className="px-4 py-3 border-b border-border-subtle/30">
                    <WorkspaceSwitcher />
                </div>
            )}

            {/* Navigation */}
            <nav className={`flex-1 overflow-y-auto pt-6 pb-4 space-y-1 ${sidebarCollapsed ? 'px-2' : 'px-4'}`}>
                {navItemKeys.map(({ labelKey, view, icon }) => {
                    const active = activeView === view;
                    return (
                        <button
                            key={view}
                            onClick={() => {
                                // Instead of just setting activeView, we push history
                                router.push(`/?tab=${view}`);
                                setActiveView(view);
                                setMobileMenuOpen(false);
                            }}
                            title={t[labelKey]}
                            className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'} rounded-xl transition-all duration-200 group ${active
                                ? 'bg-[#e6f0f5] dark:bg-primary/20 text-primary font-semibold'
                                : 'text-text-muted hover:bg-[#f5f7fa] dark:hover:bg-gray-800 hover:text-primary font-medium'
                                }`}
                        >
                            <span className={`material-symbols-outlined ${active ? 'filled' : 'group-hover:scale-110 transition-transform'}`}>
                                {icon}
                            </span>
                            {!sidebarCollapsed && <span className="text-sm">{t[labelKey]}</span>}
                        </button>
                    );
                })}

                <div className="pt-4 mt-4 border-t border-border-subtle/30">
                    {!sidebarCollapsed && <p className="px-4 text-xs font-bold text-text-muted uppercase tracking-wider mb-2">{t.nav_system}</p>}

                    {/* Notification Bell Button (just the button, popover is rendered at aside level) */}
                    <button
                        ref={notifBtnRef}
                        onClick={() => setNotifOpen(!notifOpen)}
                        title={t.nav_notifications}
                        className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center p-3 relative' : 'gap-3 px-4 py-3'} rounded-xl transition-all duration-200 group ${notifOpen
                            ? 'bg-[#e6f0f5] dark:bg-primary/20 text-primary font-semibold'
                            : 'text-text-muted hover:bg-[#f5f7fa] dark:hover:bg-gray-800 hover:text-primary font-medium'
                            }`}
                    >
                        <span className="material-symbols-outlined group-hover:scale-110 transition-transform">
                            notifications
                        </span>
                        {!sidebarCollapsed && <span className="text-sm">{t.nav_notifications}</span>}
                        
                        {unreadCount > 0 ? (
                            <div className={`${sidebarCollapsed ? 'absolute top-1.5 right-1.5 min-w-[16px] h-[16px] text-[8px]' : 'ml-auto min-w-[22px] h-[22px] text-[10px]'} flex items-center justify-center rounded-full bg-red-500 text-white font-bold px-1.5`}>
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </div>
                        ) : hasPendingInvites ? (
                            <span className={`${sidebarCollapsed ? 'absolute top-2 right-2' : 'ml-auto'} w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse flex-shrink-0`} />
                        ) : null}
                    </button>

                    {systemItemKeys.map(({ labelKey, view, icon }) => {
                        const active = activeView === view;
                        return (
                            <button
                                key={view}
                                onClick={() => {
                                    router.push(`/?tab=${view}`);
                                    setActiveView(view);
                                    setMobileMenuOpen(false);
                                }}
                                title={t[labelKey]}
                                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center p-3 mt-1' : 'gap-3 px-4 py-3'} rounded-xl transition-all duration-200 group ${active
                                    ? 'bg-[#e6f0f5] dark:bg-primary/20 text-primary font-semibold'
                                    : 'text-text-muted hover:bg-[#f5f7fa] dark:hover:bg-gray-800 hover:text-primary font-medium'
                                    }`}
                            >
                                <span className={`material-symbols-outlined ${active ? 'filled' : 'group-hover:scale-110 transition-transform'}`}>
                                    {icon}
                                </span>
                                {!sidebarCollapsed && <span className="text-sm">{t[labelKey]}</span>}
                            </button>
                        );
                    })}
                </div>
            </nav>

            {/* Notification Popover — single instance, always mounted, visibility toggled */}
            <div
                ref={notifPanelRef}
                className={`absolute left-full z-[60] ml-2 transition-opacity duration-150 ${notifOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                style={{ top: `${panelTop}px` }}
            >
                <NotificationDropdown
                    variant="sidebar"
                    onPendingInviteChange={handlePendingInviteChange}
                    onUnreadCountChange={handleUnreadCountChange}
                />
            </div>

            {/* User Profile */}
            <div className={`border-t border-border-subtle/30 ${sidebarCollapsed ? 'p-2 flex justify-center pb-4' : 'p-4'}`}>
                {sidebarCollapsed ? (
                    <button
                        className="w-10 h-10 rounded-full hover:opacity-80 transition-opacity relative group flex items-center justify-center overflow-hidden"
                        onClick={handleLogout}
                        title={t.sidebar_logout}
                    >
                        {currentUserProfile?.avatar_url ? (
                            <img
                                src={currentUserProfile.avatar_url}
                                alt={profileName}
                                className="w-10 h-10 rounded-full object-cover border border-border-subtle group-hover:opacity-10 transition-opacity"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-primary/20 border border-border-subtle flex items-center justify-center text-primary font-bold group-hover:opacity-10 transition-opacity">
                                {profileName.charAt(0)}
                            </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                           <span className="material-symbols-outlined text-red-500 text-[20px] drop-shadow-md">logout</span>
                        </div>
                    </button>
                ) : (
                    <button
                        className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-[#f5f7fa] dark:hover:bg-gray-800 transition-colors text-left"
                        onClick={handleLogout}
                        title={t.sidebar_logout}
                    >
                        {currentUserProfile?.avatar_url ? (
                            <img
                                src={currentUserProfile.avatar_url}
                                alt={profileName}
                                className="w-10 h-10 rounded-full object-cover border border-border-subtle flex-shrink-0"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-primary/20 border border-border-subtle flex items-center justify-center text-primary font-bold flex-shrink-0">
                                {profileName.charAt(0)}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-text-main dark:text-gray-100 truncate">{profileName}</p>
                            <p className="text-xs text-text-muted truncate">{profileRole}</p>
                        </div>
                        <span className="material-symbols-outlined text-text-muted hover:text-red-500 transition-colors">logout</span>
                    </button>
                )}
            </div>
        </aside>
    );
}
