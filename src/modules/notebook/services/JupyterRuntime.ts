import { singleton } from '@shared/application/utilities/singleton';
import { getConfig } from '@core/config/daemon';
import { DockerRuntime, getDockerRuntime } from '@shared/infrastructure/runtime/DockerRuntime';
import {
    HTTP_PORTS_LABEL_KEY,
    READINESS_HTTP_PATH_LABEL_KEY,
    READINESS_HTTP_QUERY_LABEL_KEY,
    TEAM_CLUSTER_ID_LABEL_KEY,
    TEAM_ID_LABEL_KEY,
    WEBSOCKET_PORTS_LABEL_KEY,
    resolveComposeDefaultNetworkName
} from '@shared/contracts/types/runtime-container';
import { createHash } from 'node:crypto';
import type { CreateNotebookSessionRequest, CreateNotebookSessionResponse, NotebookContainerResources, NotebookSessionSnapshot } from '@shared/contracts';
import type { DaemonConfig } from '@core/config/daemon';
import path from 'node:path';
import os from 'node:os';

interface EnsureContainerResult {
    containerId: string;
}

const NOTEBOOK_LABEL_KIND_KEY = 'volt.runtime.kind';
const NOTEBOOK_LABEL_KIND_VALUE = 'jupyter';
const NOTEBOOK_ID_LABEL_KEY = 'volt.notebook.id';
const RUNTIME_FINGERPRINT_ENV_KEY = 'VOLT_RUNTIME_FINGERPRINT';
const PUBLIC_BASE_PATH_ENV_KEY = 'VOLT_PUBLIC_BASE_PATH';

export class JupyterRuntime {
    constructor(
        private readonly config: DaemonConfig,
        private readonly dockerRuntime: DockerRuntime
    ) {}

    async ensureSession(input: CreateNotebookSessionRequest): Promise<CreateNotebookSessionResponse> {
        const notebookPath = this.resolveNotebookRelativePath(input.notebook.notebookPath);
        const normalizedInput: CreateNotebookSessionRequest = {
            ...input,
            notebook: {
                ...input.notebook,
                notebookPath
            }
        };

        const { containerId } = await this.ensureContainer(normalizedInput);
        await this.syncNotebookContents(containerId, notebookPath, input.notebook.content);

        const internalPath = path.posix.join(
            this.config.jupyter.uiPath,
            'tree',
            notebookPath.split('/').map(encodeURIComponent).join('/')
        );

        return {
            jupyter: {
                internalPath,
                url: internalPath,
                ready: false,
                containerStage: 'creating'
            }
        };
    }

    private async ensureContainer(input: CreateNotebookSessionRequest): Promise<EnsureContainerResult> {
        const existingContainerId = await this.findRuntimeContainerId(input.notebook._id);
        if (existingContainerId) {
            if (await this.shouldRecreateContainer(existingContainerId, input)) {
                await this.dockerRuntime.deleteContainer(existingContainerId);
            } else {
                const container = await this.dockerRuntime.getContainer(existingContainerId);
                if (!container.State.Running) {
                    await this.dockerRuntime.startContainer(existingContainerId);
                }

                return { containerId: existingContainerId };
            }
        }

        const containerResources = this.resolveNotebookContainerResources();
        const jupyterPort = this.config.jupyter.port;
        const container = await this.dockerRuntime.createContainer({
            image: this.config.jupyter.image,
            name: this.buildContainerName(input.notebook._id),
            env: [
                {
                    key: 'JUPYTER_TOKEN',
                    value: this.config.jupyter.token
                },
                {
                    key: 'VOLT_NOTEBOOK_ID',
                    value: input.notebook._id
                },
                {
                    key: 'VOLT_NOTEBOOK_PATH',
                    value: input.notebook.notebookPath
                },
                {
                    key: 'VOLT_TEAM_ID',
                    value: input.notebook.teamId
                },
                {
                    key: 'VOLT_REQUESTED_BY',
                    value: input.requestedBy
                },
                {
                    key: 'VOLT_BASE_URL',
                    value: input.baseUrl
                },
                ...(input.secretKey ? [{
                    key: 'VOLT_SECRET_KEY',
                    value: input.secretKey
                }] : []),
                ...(input.trajectoryId ? [{
                    key: 'VOLT_TRAJECTORY_ID',
                    value: input.trajectoryId
                }] : []),
                {
                    key: PUBLIC_BASE_PATH_ENV_KEY,
                    value: input.publicBasePath
                },
                {
                    key: 'DOCKER_STACKS_JUPYTER_CMD',
                    value: 'lab'
                },
                {
                    key: RUNTIME_FINGERPRINT_ENV_KEY,
                    value: this.buildRuntimeFingerprint(input)
                }
            ],
            ports: [{ private: jupyterPort }],
            publishUnassignedPorts: true,
            memoryInMegabytes: containerResources.memoryMB,
            cpus: containerResources.cpus,
            labels: {
                [TEAM_ID_LABEL_KEY]: input.notebook.teamId,
                [TEAM_CLUSTER_ID_LABEL_KEY]: this.config.teamClusterId,
                [NOTEBOOK_LABEL_KIND_KEY]: NOTEBOOK_LABEL_KIND_VALUE,
                [NOTEBOOK_ID_LABEL_KEY]: input.notebook._id,
                [HTTP_PORTS_LABEL_KEY]: `${jupyterPort}`,
                [WEBSOCKET_PORTS_LABEL_KEY]: `${jupyterPort}`,
                [READINESS_HTTP_PATH_LABEL_KEY]: path.posix.join(input.publicBasePath, 'api'),
                [READINESS_HTTP_QUERY_LABEL_KEY]: `token=${encodeURIComponent(this.config.jupyter.token)}`
            },
            cmd: this.buildNativeStartupCommand(input.publicBasePath),
            networkMode: resolveComposeDefaultNetworkName(this.config.composeProjectName)
        });

        return { containerId: container.Id };
    }

    private async syncNotebookContents(
        containerId: string,
        notebookPath: string,
        notebookContent: NotebookSessionSnapshot['content']
    ): Promise<void> {
        const notebookContents = JSON.stringify(notebookContent, null, 2);

        const notebookFilePath = path.posix.join(this.config.jupyter.notebookRoot, notebookPath);
        await this.dockerRuntime.writeContainerFile(
            containerId,
            notebookFilePath,
            notebookContents,
            {
                operationName: 'jupyter-write-notebook',
                timeoutMs: this.config.jupyter.execTimeoutMs
            }
        );
    }

    private async findRuntimeContainerId(notebookId: string): Promise<string | null> {
        const includeStoppedContainers = true;
        const containers = await this.dockerRuntime.listContainers(includeStoppedContainers, {
            label: [
                `${NOTEBOOK_LABEL_KIND_KEY}=${NOTEBOOK_LABEL_KIND_VALUE}`,
                `${NOTEBOOK_ID_LABEL_KEY}=${notebookId}`
            ]
        });
        const runtimeContainer = [...containers].sort((left, right) => {
            const runningDelta = Number(right.State === 'running') - Number(left.State === 'running');
            if (runningDelta !== 0) {
                return runningDelta;
            }

            return (right.Created ?? 0) - (left.Created ?? 0);
        })[0];

        return runtimeContainer?.Id ?? null;
    }

    private resolveNotebookRelativePath(value: string): string {
        if (!value) {
            throw new Error('Notebook path is required');
        }

        if (path.posix.isAbsolute(value)) {
            throw new Error('Notebook path must be relative to notebook root');
        }

        const normalizedPath = path.posix.normalize(value);
        if (normalizedPath === '.' || normalizedPath === '..' || normalizedPath.startsWith('../')) {
            throw new Error('Notebook path must stay within notebook root');
        }

        return normalizedPath;
    }

    private buildRuntimeFingerprint(input: CreateNotebookSessionRequest): string {
        const containerResources = this.resolveNotebookContainerResources();
        return createHash('sha1').update(JSON.stringify({
            image: this.config.jupyter.image,
            notebookPath: input.notebook.notebookPath,
            teamId: input.notebook.teamId,
            requestedBy: input.requestedBy,
            publicBasePath: input.publicBasePath,
            port: this.config.jupyter.port,
            token: this.config.jupyter.token,
            frameAncestors: this.config.jupyter.frameAncestors,
            notebookRoot: this.config.jupyter.notebookRoot,
            networkMode: resolveComposeDefaultNetworkName(this.config.composeProjectName),
            containerResources,
            startupCommand: this.buildNativeStartupCommand(input.publicBasePath)
        })).digest('hex');
    }

    private resolveNotebookContainerResources(): NotebookContainerResources {
        const detectedCpus = os.availableParallelism();
        const detectedMemoryMB = Math.floor(os.totalmem() / (1024 * 1024));

        return {
            cpus: detectedCpus > 0
                ? detectedCpus
                : Math.max(1, Math.floor(this.config.jupyter.cpus)),
            memoryMB: detectedMemoryMB > 0
                ? detectedMemoryMB
                : Math.max(128, Math.floor(this.config.jupyter.memoryInMegabytes))
        };
    }

    private buildNativeStartupCommand(publicBasePath: string): string[] {
        const tornadoSettings = JSON.stringify({
            headers: {
                'Content-Security-Policy': `frame-ancestors ${this.config.jupyter.frameAncestors}`
            }
        });
        const baseUrl = publicBasePath === '/' ? '/' : `${publicBasePath}/`;

        return [
            '/bin/sh',
            '-lc',
            [
                `mkdir -p "${this.config.jupyter.notebookRoot}"`,
                '&&',
                'exec start-notebook.py',
                '--ServerApp.ip=0.0.0.0',
                `--ServerApp.port=${this.config.jupyter.port}`,
                '--ServerApp.port_retries=0',
                '--ServerApp.open_browser=False',
                `--ServerApp.token="${this.config.jupyter.token}"`,
                `--ServerApp.base_url="${baseUrl}"`,
                '--ServerApp.allow_remote_access=True',
                `--ServerApp.root_dir="${this.config.jupyter.notebookRoot}"`,
                '--ServerApp.allow_root=True',
                `--ServerApp.tornado_settings='${tornadoSettings}'`
            ].join(' ')
        ];
    }

    private buildContainerName(notebookId: string): string {
        return `volt-jupyter-${notebookId}`;
    }

    private async shouldRecreateContainer(
        containerId: string,
        input: CreateNotebookSessionRequest
    ): Promise<boolean> {
        const currentFingerprint = await this.readContainerEnvValue(containerId, RUNTIME_FINGERPRINT_ENV_KEY);
        if (currentFingerprint === null) {
            return false;
        }

        return currentFingerprint !== this.buildRuntimeFingerprint(input);
    }

    private async readContainerEnvValue(containerId: string, key: string): Promise<string | null> {
        try {
            const environment = (await this.dockerRuntime.getContainer(containerId)).Config.Env;
            if (!environment) {
                return null;
            }

            const prefix = `${key}=`;
            const entry = environment.find((value) => value.startsWith(prefix));
            return entry ? entry.slice(prefix.length) : null;
        } catch {
            return null;
        }
    }
}

export const getJupyterRuntime = singleton((): JupyterRuntime => new JupyterRuntime(getConfig(), getDockerRuntime()));
