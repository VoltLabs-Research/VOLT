import { useDesktopWindowState } from '@/shared/presentation/hooks/use-desktop-window-state';
import { useCallback } from 'react';

/** Provides window control handlers and state for the desktop titlebar. */
export const useDesktopTitlebar = () => {
    const { isDesktop, windowState } = useDesktopWindowState();

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
        isFullScreen: windowState.isFullScreen,
        isMaximized: windowState.isMaximized
    };
};
