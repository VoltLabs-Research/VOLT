import type { AppEvents } from '@/types/events';
import type { DevModeState, DeploymentState } from '@/services/AppConfig';
import type { RemoteProbeResult } from '@/services/RemoteProbe';

declare global{
    interface Window{
        volt: {
            platform: NodeJS.Platform;
            deploy: {
                start: () => Promise<void>;
                stop: () => Promise<void>;
                reset: () => Promise<void>;
            };
            docker: {
                preflight: () => Promise<AppEvents['deploy:preflight']>;
            };
            config: {
                get: () => Promise<Record<string, any>>;
            };
            shell: {
                openExternal: (url: string) => Promise<void>;
            };
            devmode: {
                apply: (payload: DevModeState) => Promise<void>;
            };
            dialog: {
                pickDirectory: () => Promise<string | null>;
            };
            app: {
                voltUrl: () => Promise<string>;
                openClient: () => Promise<void>;
                openShell: (intent?: string) => Promise<void>;
            };
            remote: {
                probe: (endpoint: string) => Promise<RemoteProbeResult>;
                connect: (endpoint: string) => Promise<RemoteProbeResult>;
            };
            deployment: {
                get: () => Promise<DeploymentState | null>;
                setLocal: () => Promise<void>;
                reset: () => Promise<void>;
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
