import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
    resolveDesktopPlatform,
    type DesktopWindowState,
    type VoltDesktopApi
} from './desktop-contract';

const detectDesktopPlatform = () => {
    if (typeof navigator === 'undefined') {
        return resolveDesktopPlatform('unknown');
    }

    const userAgent = navigator.userAgent;

    if (userAgent.includes('Windows')) {
        return resolveDesktopPlatform('win32');
    }

    if (userAgent.includes('Mac OS X') || userAgent.includes('Macintosh')) {
        return resolveDesktopPlatform('darwin');
    }

    if (userAgent.includes('Linux')) {
        return resolveDesktopPlatform('linux');
    }

    return resolveDesktopPlatform('unknown');
};

const createTauriDesktopApi = (): VoltDesktopApi => {
    const appWindow = getCurrentWindow();

    const getWindowState = async (): Promise<DesktopWindowState> => {
        return {
            isFullScreen: await appWindow.isFullscreen(),
            isMaximized: await appWindow.isMaximized()
        };
    };

    return {
        isDesktop: true,
        runtime: 'tauri',
        platform: detectDesktopPlatform(),
        windowControls: {
            minimize: async () => {
                await appWindow.minimize();
            },
            toggleMaximize: async () => {
                await appWindow.toggleMaximize();
            },
            close: async () => {
                try {
                    await appWindow.close();
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);

                    if (!message.includes('allow-destroy')) {
                        throw error;
                    }

                    await appWindow.destroy();
                }
            },
            getState: getWindowState,
            onStateChange: (callback) => {
                let isActive = true;

                const emitWindowState = async () => {
                    if (!isActive) {
                        return;
                    }

                    callback(await getWindowState());
                };

                const subscriptions = [
                    appWindow.onResized(() => {
                        emitWindowState().catch(() => undefined);
                    }),
                    appWindow.onMoved(() => {
                        emitWindowState().catch(() => undefined);
                    }),
                    appWindow.onScaleChanged(() => {
                        emitWindowState().catch(() => undefined);
                    }),
                    appWindow.onFocusChanged(() => {
                        emitWindowState().catch(() => undefined);
                    }),
                    appWindow.onCloseRequested(() => {
                        emitWindowState().catch(() => undefined);
                    })
                ];

                emitWindowState().catch(() => undefined);

                return () => {
                    isActive = false;

                    Promise.allSettled(subscriptions).then((results) => {
                        results.forEach((result) => {
                            if (result.status === 'fulfilled') {
                                result.value();
                            }
                        });
                    }).catch(() => undefined);
                };
            }
        }
    };
};

export const initializeDesktopRuntime = (): void => {
    if (typeof window === 'undefined' || window.voltDesktop || !isTauri()) {
        return;
    }

    window.voltDesktop = createTauriDesktopApi();
};
