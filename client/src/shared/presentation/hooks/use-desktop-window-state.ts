import { createDefaultDesktopWindowState } from '@/shared/utils/desktop-contract';
import { isDesktopEnvironment } from '@/shared/utils/desktop-environment';
import { useEffect, useState } from 'react';
import type { DesktopWindowState } from '@/shared/utils/desktop-contract';

export const useDesktopWindowState = () => {
    const [windowState, setWindowState] = useState<DesktopWindowState>(createDefaultDesktopWindowState);
    const isDesktop = isDesktopEnvironment();

    useEffect(() => {
        if (!isDesktop || !window.voltDesktop) {
            return;
        }

        let isMounted = true;

        const syncWindowState = async () => {
            const nextState = await window.voltDesktop?.windowControls.getState();

            if (isMounted && nextState) {
                setWindowState(nextState);
            }
        };

        syncWindowState().catch(() => undefined);

        const unsubscribe = window.voltDesktop.windowControls.onStateChange((nextState) => {
            if (isMounted) {
                setWindowState(nextState);
            }
        });

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, [isDesktop]);

    return {
        isDesktop,
        windowState
    };
};
