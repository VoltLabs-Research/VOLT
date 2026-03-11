import { isElectronEnvironment } from '@/shared/utils/electron-environment';
import { useCallback, useEffect, useState } from 'react';
import type { DesktopWindowState } from '@/shared/utils/electron-contract';

const DEFAULT_WINDOW_STATE: DesktopWindowState = {
    isFullScreen: false,
    isMaximized: false
};

/** Provides window control handlers and state for the desktop titlebar. */
export const useDesktopTitlebar = () => {
    const [windowState, setWindowState] = useState<DesktopWindowState>(DEFAULT_WINDOW_STATE);
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

        syncWindowState();
        const unsubscribe = window.voltDesktop.windowControls.onStateChange(setWindowState);

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, [isDesktop]);

    const handleMinimize = useCallback(() => {
        window.voltDesktop?.windowControls.minimize();
    }, []);

    const handleToggleMaximize = useCallback(() => {
        window.voltDesktop?.windowControls.toggleMaximize();
    }, []);

    const handleClose = useCallback(() => {
        window.voltDesktop?.windowControls.close();
    }, []);

    return {
        handleClose,
        handleMinimize,
        handleToggleMaximize,
        isDesktop,
        isMaximized: windowState.isMaximized
    };
};
