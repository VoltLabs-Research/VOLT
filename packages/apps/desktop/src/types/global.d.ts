import type { AppEvents } from '@/types/events';
import type { DevModeState, ThemePreference } from '@/services/AppConfig';

export interface ConfirmOptions{
    title: string;
    message: string;
    detail?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
}

declare global{
    interface Window{
        volt: {
            platform: NodeJS.Platform;
            deploy: {
                start: () => Promise<void>;
                stop: () => Promise<void>;
                reset: () => Promise<void>;
            };
            config: {
                get: () => Promise<Record<string, unknown>>;
            };
            shell: {
                openExternal: (url: string) => Promise<void>;
            };
            devmode: {
                apply: (payload: DevModeState) => Promise<void>;
            };
            dialog: {
                pickDirectory: () => Promise<string | null>;
                confirm: (options: ConfirmOptions) => Promise<boolean>;
            };
            app: {
                openClient: () => Promise<void>;
                openShell: (intent?: string) => Promise<void>;
            };
            theme: {
                set: (theme: ThemePreference) => Promise<void>;
            };
            window: {
                minimize: () => Promise<void>;
                maximize: () => Promise<void>;
                close: () => Promise<void>;
            };
            on: <K extends keyof AppEvents>(channel: K, cb: (p: AppEvents[K]) => void) => () => void;
        }
    }
}

export {};
