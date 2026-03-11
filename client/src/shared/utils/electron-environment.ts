import { DesktopPlatform } from './electron-contract';

export const isElectronEnvironment = (): boolean => {
    return Boolean(window.voltDesktop?.isElectron);
};

export const getDesktopPlatform = (): DesktopPlatform => {
    return window.voltDesktop?.platform ?? DesktopPlatform.Unknown;
};
