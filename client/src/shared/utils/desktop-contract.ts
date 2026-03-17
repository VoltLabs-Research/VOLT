export enum DesktopPlatform {
    MacOS = 'darwin',
    Windows = 'win32',
    Linux = 'linux',
    Unknown = 'unknown'
};

export interface DesktopWindowState {
    isFullScreen: boolean;
    isMaximized: boolean;
};

export interface DesktopWindowControlsApi {
    minimize: () => Promise<void>;
    toggleMaximize: () => Promise<void>;
    close: () => Promise<void>;
    getState: () => Promise<DesktopWindowState>;
    onStateChange: (callback: (state: DesktopWindowState) => void) => () => void;
};

export interface VoltDesktopApi {
    isDesktop: boolean;
    runtime: 'tauri';
    platform: DesktopPlatform;
    windowControls: DesktopWindowControlsApi;
};

export const createDefaultDesktopWindowState = (): DesktopWindowState => {
    return {
        isFullScreen: false,
        isMaximized: false
    };
};

export const isDesktopWindowState = (value: unknown): value is DesktopWindowState => {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    return 'isFullScreen' in value && 'isMaximized' in value;
};

export const resolveDesktopPlatform = (platform: string): DesktopPlatform => {
    if (platform === DesktopPlatform.MacOS) {
        return DesktopPlatform.MacOS;
    }

    if (platform === DesktopPlatform.Windows) {
        return DesktopPlatform.Windows;
    }

    if (platform === DesktopPlatform.Linux) {
        return DesktopPlatform.Linux;
    }

    return DesktopPlatform.Unknown;
};
