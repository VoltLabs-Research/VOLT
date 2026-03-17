import { isTauri } from '@tauri-apps/api/core';
import { DesktopPlatform, resolveDesktopPlatform } from './desktop-contract';

const detectNavigatorPlatform = (): DesktopPlatform => {
    if (typeof navigator === 'undefined') {
        return DesktopPlatform.Unknown;
    }

    const userAgent = navigator.userAgent;

    if (userAgent.includes('Windows')) {
        return DesktopPlatform.Windows;
    }

    if (userAgent.includes('Mac OS X') || userAgent.includes('Macintosh')) {
        return DesktopPlatform.MacOS;
    }

    if (userAgent.includes('Linux')) {
        return DesktopPlatform.Linux;
    }

    return DesktopPlatform.Unknown;
};

export const isDesktopEnvironment = (): boolean => {
    if (typeof window === 'undefined') {
        return false;
    }

    return isTauri() || Boolean(window.voltDesktop?.isDesktop);
};

export const getDesktopPlatform = (): DesktopPlatform => {
    if (typeof window !== 'undefined' && window.voltDesktop?.platform) {
        return resolveDesktopPlatform(window.voltDesktop.platform);
    }

    return detectNavigatorPlatform();
};
