import { useState, useEffect } from 'react';
import { useStore } from './useStore';
import type { Store } from './useStore';

export function useStorePersistent<T>(
    selector: (state: Store) => T
): T | undefined {
    const store = useStore(selector);
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        setIsHydrated(true);
    }, []);

    return isHydrated ? store : undefined;
}
