import { AppEvents } from '@/services/EventBus';

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
            app: {
                voltUrl: () => Promise<string>;
            };
            on: <K extends keyof AppEvents>(channel: K, cb: (p: AppEvents[K]) => void) => () => void;
        }
    }
}

export {};
