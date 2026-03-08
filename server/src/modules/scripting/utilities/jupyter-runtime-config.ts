import { readNumberEnv } from '@shared/infrastructure/utilities/env';

interface JupyterHostPortRange {
    start: number;
    end: number;
};

interface JupyterRuntimeConfig {
    image: string;
    port: number;
    token: string;
    uiPath: string;
    frameAncestors: string;
    startTimeoutMs: number;
    hostPortRange: JupyterHostPortRange;
    publicHost: string;
    publicProtocol: string;
};

export interface ScriptingRuntimeConfig {
    memoryMb: number;
    cpus: number;
    execTimeoutMs: number;
    notebookRoot: string;
    jupyter: JupyterRuntimeConfig;
};

let config: ScriptingRuntimeConfig | null = null;

export const getJupyterRuntimeConfig = (): ScriptingRuntimeConfig => {
    if (config) {
        return config;
    }

    const image = 'volt-scripting-env:latest';
    const publicHost = process.env.SERVER_HOSTNAME || '0.0.0.0';
    const publicProtocol = process.env.SERVER_SCHEMA || 'http';

    config = {
        memoryMb: readNumberEnv('JUPYTER_CONTAINER_MEMORY_MB', 2048),
        cpus: readNumberEnv('JUPYTER_CONTAINER_CPUS', 2),
        execTimeoutMs: readNumberEnv('JUPYTER_EXEC_TIMEOUT_MS', 45000),
        notebookRoot: '/home/jovyan/work/volt-notebooks',
        jupyter: {
            image,
            port: 8888,
            token: 'volt-scripting',
            uiPath: '/doc',
            frameAncestors: '*',
            startTimeoutMs: 30000,
            hostPortRange: {
                start: 38000,
                end: 38999
            },
            publicHost,
            publicProtocol
        }
    };

    return config;
};
