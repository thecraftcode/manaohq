'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ThemeToggle({ isSidebar = true }: { isSidebar?: boolean }) {
    const { theme, setTheme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // Only render the toggle when mounted on client to prevent hydration mismatch
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className={`w-8 h-8 ${isSidebar ? 'md:w-full md:h-10' : ''} opacity-0`} />; // Placeholder with same dimensions
    }

    return (
        <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className={`
                group relative flex items-center
                ${isSidebar ? 'w-full py-2.5 px-3 rounded-lg hover:bg-background-light dark:hover:bg-gray-800/50' : 'w-14 h-7 rounded-full'} 
                transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50
                ${!isSidebar && resolvedTheme === 'dark' ? 'bg-primary' : ''}
                ${!isSidebar && resolvedTheme === 'light' ? 'bg-slate-300' : ''}
            `}
            title="Toggle theme"
            aria-label="Toggle theme"
        >
            {isSidebar ? (
                // Sidebar Version: Text + Icon
                <>
                    <div className="flex-1 flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg border ${resolvedTheme === 'dark' ? 'bg-agency-800 border-agency-700' : 'bg-white border-brand-100 shadow-sm'}`}>
                            {resolvedTheme === 'dark' ? (
                                <Sun className="w-4 h-4 text-amber-400" />
                            ) : (
                                <Moon className="w-4 h-4 text-slate-500" />
                            )}
                        </div>
                        <span className="text-sm font-medium text-text-muted group-hover:text-text-main dark:text-gray-400 dark:group-hover:text-gray-200 transition-colors text-left hidden md:inline-block">
                            {resolvedTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                        </span>
                    </div>
                </>
            ) : (
                // Settings Version: True Switch Toggle
                <>
                    <div className="sr-only">Toggle Dark Mode</div>
                    <div
                        className={`
                            absolute left-1 flex items-center justify-center w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ease-spring
                            ${resolvedTheme === 'dark' ? 'translate-x-7' : 'translate-x-0'}
                        `}
                    >
                        {resolvedTheme === 'dark' ? (
                            <Moon className="w-3 h-3 text-primary" />
                        ) : (
                            <Sun className="w-3 h-3 text-amber-500" />
                        )}
                    </div>
                </>
            )}
        </button>
    );
}
