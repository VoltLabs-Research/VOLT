import { createDefaultDesktopWindowState, type DesktopWindowState } from '@/shared/utils/electron-contract';
import { isElectronEnvironment } from '@/shared/utils/electron-environment';
import { useEffect, useState } from 'react';

export const useDesktopWindowState = () => {
    const [windowState, setWindowState] = useState<DesktopWindowState>(createDefaultDesktopWindowState);
    const isDesktop = isElectronEnvironment();

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

        void syncWindowState();

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
