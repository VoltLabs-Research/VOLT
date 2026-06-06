import { AppEvents } from '@/services/EventBus';
import { DevModeState } from '@/services/AppConfig';

declare global{
    interface Window{
        volt: {
            deploy: {
                start: () => Promise<void>;
                stop:  () => Promise<void>;
            };
            config: {
                get:    () => Promise<Record<string, any>>;
                update: (payload: object) => Promise<void>;
            };
            devmode: {
                apply: (payload: DevModeState) => Promise<void>;
            };
            dialog: {
                pickDirectory: () => Promise<string | null>;
            };
            app: {
                voltUrl: () => Promise<string>;
            };
            window: {
                minimize: () => Promise<void>;
                maximize: () => Promise<void>;
                close:    () => Promise<void>;
            };
            on: <K extends keyof AppEvents>(channel: K, cb: (p: AppEvents[K]) => void) => () => void;
        }
    }
}

export {};
