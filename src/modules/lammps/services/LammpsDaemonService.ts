import { DockerRuntimeService } from '@/modules/platform/services';
import type { GlbExporterService, TrajectoryParserService } from '@/modules/trajectory-native/services';
import type { ClusterObjectStore } from '@/shared/storage/ClusterObjectStore';
import { ObjectBucketName, OrchestrationAction } from '@/shared/contracts';
import { compressFileWithZstd } from '@/shared/utilities/storage-codec';
import Docker from 'dockerode';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { VoltCloudConnection } from '@/modules/cloud-control/services';
import { ProgressStageType } from '@voltstack/daemon-cluster-client';

interface RuntimeBuildResult {
    tag: string;
    hash: string;
    created: boolean;
    imageId?: string;
}

interface RuntimeRunSnapshot {
    id: string;
    imageTag: string;
    state: string;
    outputDir: string;
    createdAt: string;
    startedAt?: string;
    endedAt?: string;
    containerId?: string;
    exitCode?: number | null;
    errorMessage?: string;
    lastStep?: number;
}

interface RuntimeEventPayload {
    runId?: string;
    tag?: string;
    hash?: string;
    message?: string;
    error?: string;
    imageTag?: string;
    outputDir?: string;
    containerId?: string;
    line?: string;
    state?: string;
    exitCode?: number | null;
    path?: string;
    step?: number;
    snapshot?: RuntimeRunSnapshot;
}

interface RuntimeRunHandle {
    runId: string;
    stop(): Promise<void>;
    kill(): Promise<void>;
}

interface RuntimeSimulationSpec {
    image: string;
    inputFile: string;
    inputFiles?: string[];
    outputDir: string;
    env?: Record<string, string>;
    resources?: {
        cpus?: number;
    };
    execution?: {
        mpiRanks?: number;
        extraArgs?: string[];
    };
    labels?: Record<string, string>;
    dumpWatch?: {
        enabled?: boolean;
        patterns?: string[];
        parseTimesteps?: boolean;
    };
    cleanup?: {
        removeContainer?: boolean;
        removeWorkspace?: boolean;
    };
}

interface RuntimeBuildSpec {
    repository?: string;
    imageTag?: string;
    packages?: string[];
    openmp?: boolean;
}

interface RuntimeInstance {
    build(spec: RuntimeBuildSpec): Promise<RuntimeBuildResult>;
    run(spec: RuntimeSimulationSpec): Promise<RuntimeRunHandle>;
    on(event: string, handler: (payload: RuntimeEventPayload) => void): () => void;
}

interface RuntimeModuleShape {
    LammpsRuntime?: new (options?: { docker?: Docker }) => RuntimeInstance;
    default?: new (options?: { docker?: Docker }) => RuntimeInstance;
}

interface HostPathMapping {
    containerPath: string;
    hostPath: string;
}

interface ProvisionLammpsContainerInput {
    operationId: string;
    lammpsContainerId: string;
    name: string;
    packages: string[];
    cpus: number;
    workspaceContainerName?: string;
}

interface ProvisionLammpsContainerResult {
    imageTag: string;
    imageHash: string;
    workspaceContainerId: string;
    workspaceContainerName: string;
    workspaceRootPath: string;
}

interface LammpsFilesystemPathInput {
    workspaceContainerId: string;
    targetPath: string;
}

interface LammpsFilesystemListInput extends LammpsFilesystemPathInput {}

interface LammpsFilesystemReadInput extends LammpsFilesystemPathInput {}

interface LammpsFilesystemWriteInput extends LammpsFilesystemPathInput {
    content: string;
}

interface LammpsFilesystemWriteBase64Input extends LammpsFilesystemPathInput {
    contentBase64: string;
}

interface LammpsFilesystemMoveInput extends LammpsFilesystemPathInput {
    destinationPath: string;
}

interface StartLammpsRunInput {
    executionId: string;
    scriptId: string;
    workspaceContainerId: string;
    projectRootPath: string;
    entryFilePath: string;
    imageTag: string;
    packages: string[];
    stagedTrajectoryId: string;
    storageClusterId: string;
    mpiRanks: number;
    openmpThreads: number;
}

interface StartLammpsRunResult {
    runtimeRunId: string;
}

interface StopLammpsRunInput {
    executionId: string;
}

interface ActiveExecutionState {
    executionId: string;
    scriptId: string;
    stagedTrajectoryId: string;
    storageClusterId: string;
    workspaceContainerId: string;
    runtime: RuntimeInstance;
    handle: RuntimeRunHandle | null;
    runtimeRunId: string | null;
    scratchDir: string;
    outputDir: string;
    processedTimesteps: Set<number>;
    observedDumpFiles: Map<string, number>;
    pendingDumpTasks: Set<Promise<void>>;
    dumpPoller: NodeJS.Timeout | null;
    dumpScanPromise: Promise<void> | null;
    dumpScanQueued: boolean;
    eventUnsubscribers: Array<() => void>;
}

interface DumpFrameSegment {
    timestep: number;
    contents: string;
}

interface ParsedDumpMetadata {
    timestep: number;
    natoms: number;
    simulationCell: Record<string, unknown> | null;
}

const WORKSPACE_ROOT_PATH = '/workspace/scripts';
const LAMMPS_WORKSPACE_LABEL = 'volt.lammps.workspace';
const LAMMPS_CONTAINER_LABEL = 'volt.lammps.container-id';
const EXECUTION_SCRATCH_ROOT = path.join(process.cwd(), '.runtime', 'lammps');
const DUMP_PROCESSING_SETTLE_MS = 250;
const DUMP_SCAN_INTERVAL_MS = 750;

const ensureOpenmpPackage = (packages: string[]): string[] => {
    return Array.from(new Set([
        ...packages.map((entry) => entry.trim()).filter((entry) => entry.length > 0),
        'OPENMP'
    ]));
};

const buildHybridRuntimeImageTag = (lammpsContainerId: string): string => {
    return `volt/lammps-runtime:${lammpsContainerId}-hybrid`;
};

const runtimeModule = require('../vendor/lammps-runtime/index.cjs') as RuntimeModuleShape;

const resolveRuntimeConstructor = (): new (options?: { docker?: Docker }) => RuntimeInstance => {
    const runtimeConstructor = runtimeModule.LammpsRuntime ?? runtimeModule.default;
    if (!runtimeConstructor) {
        throw new Error('LAMMPS runtime module does not expose a runtime constructor');
    }

    return runtimeConstructor;
};

const VendorLammpsRuntime = resolveRuntimeConstructor();

const delay = async (ms: number): Promise<void> => {
    await new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });
};

const toErrorMessage = (error: unknown): string => {
    return error instanceof Error ? error.message : String(error);
};

const sanitizeContainerName = (value: string): string => {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_.-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
};

const normalizeContainerPath = (value: string): string => {
    const normalized = path.posix.normalize(value);
    if (normalized === '.' || normalized === '/') {
        return '/';
    }

    return normalized.startsWith('/')
        ? normalized
        : path.posix.join('/', normalized);
};

const isContainerIdCandidate = (value: string | undefined): value is string => {
    if (!value) {
        return false;
    }

    return /^[a-f0-9]{12,64}$/i.test(value.trim());
};

const extractContainerIdFromCgroup = (): string | null => {
    try {
        const cgroup = require('node:fs').readFileSync('/proc/self/cgroup', 'utf8') as string;
        for (const line of cgroup.split('\n')) {
            const match = line.match(/([a-f0-9]{64})/i);
            if (match?.[1]) {
                return match[1];
            }
        }
    } catch {
        return null;
    }

    return null;
};

const rewriteBindSourcePath = (value: string, mappings: HostPathMapping[]): string => {
    const normalizedValue = path.posix.normalize(value);

    for (const mapping of mappings) {
        const normalizedContainerPath = path.posix.normalize(mapping.containerPath);
        if (normalizedValue !== normalizedContainerPath && !normalizedValue.startsWith(`${normalizedContainerPath}/`)) {
            continue;
        }

        const relativeSuffix = normalizedValue.slice(normalizedContainerPath.length).replace(/^\/+/, '');
        return relativeSuffix.length > 0
            ? path.join(mapping.hostPath, relativeSuffix)
            : mapping.hostPath;
    }

    return value;
};

const createHostAwareDockerClient = (): Docker => {
    const docker = new Docker({
        socketPath: '/var/run/docker.sock',
        timeout: 60_000
    });
    let mappingsPromise: Promise<HostPathMapping[]> | null = null;

    const resolveMappings = async (): Promise<HostPathMapping[]> => {
        if (mappingsPromise) {
            return mappingsPromise;
        }

        mappingsPromise = (async () => {
            const candidates = [
                process.env.HOSTNAME?.trim(),
                extractContainerIdFromCgroup() ?? undefined
            ].filter(isContainerIdCandidate);

            for (const containerId of candidates) {
                try {
                    const inspected = await docker.getContainer(containerId).inspect();
                    return (inspected.Mounts ?? [])
                        .filter((mount) => mount.Type === 'bind' && typeof mount.Source === 'string' && typeof mount.Destination === 'string')
                        .map((mount) => ({
                            containerPath: mount.Destination,
                            hostPath: mount.Source
                        }))
                        .sort((left, right) => right.containerPath.length - left.containerPath.length);
                } catch {
                    continue;
                }
            }

            return [];
        })();

        return mappingsPromise;
    };

    return new Proxy(docker, {
        get(target, property, receiver) {
            if (property !== 'createContainer') {
                const value = Reflect.get(target, property, receiver);
                return typeof value === 'function' ? value.bind(target) : value;
            }

            return async (options: Docker.ContainerCreateOptions) => {
                const mappings = await resolveMappings();
                const binds = options.HostConfig?.Binds;
                if (!Array.isArray(binds) || binds.length === 0 || mappings.length === 0) {
                    return target.createContainer(options);
                }

                const rewrittenBinds = binds.map((bind) => {
                    const [source, destination, mode] = bind.split(':');
                    if (!source || !destination) {
                        return bind;
                    }

                    const rewrittenSource = rewriteBindSourcePath(source, mappings);
                    return mode
                        ? `${rewrittenSource}:${destination}:${mode}`
                        : `${rewrittenSource}:${destination}`;
                });

                return target.createContainer({
                    ...options,
                    HostConfig: {
                        ...options.HostConfig,
                        Binds: rewrittenBinds
                    }
                });
            };
        }
    }) as Docker;
};

const normalizeProjectPath = (rootPath: string, candidatePath: string): string => {
    const normalizedRoot = normalizeContainerPath(rootPath);
    const normalizedCandidate = normalizeContainerPath(candidatePath);
    if (normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(`${normalizedRoot}/`)) {
        return normalizedCandidate;
    }

    return normalizeContainerPath(path.posix.join(normalizedRoot, candidatePath));
};

const buildDumpObjectKey = (trajectoryId: string, timestep: number): string => {
    return `trajectory-${trajectoryId}/timestep-${timestep}.dump.zst`;
};

const createRuntimeTimestamp = (): string => {
    return new Date().toISOString();
};

const isDumpCandidatePath = (candidatePath: string): boolean => {
    const fileName = path.basename(candidatePath).toLowerCase();
    return fileName.startsWith('dump')
        || fileName.endsWith('.dump')
        || fileName.endsWith('.lammpstrj')
        || fileName.endsWith('.traj');
};

const parseDumpFrameSegment = (segment: string): DumpFrameSegment | null => {
    const lines = segment.replace(/\r\n/g, '\n').split('\n');
    if (!/^ITEM:\s+TIMESTEP\s*$/.test(lines[0] ?? '')) {
        return null;
    }

    const timestep = Number((lines[1] ?? '').trim());
    if (!Number.isFinite(timestep)) {
        return null;
    }

    if (!/^ITEM:\s+NUMBER OF ATOMS\s*$/.test(lines[2] ?? '')) {
        return null;
    }

    const atomCount = Number((lines[3] ?? '').trim());
    if (!Number.isFinite(atomCount) || atomCount < 0) {
        return null;
    }

    if (!/^ITEM:\s+BOX BOUNDS\b/.test(lines[4] ?? '')) {
        return null;
    }

    if (lines[5] === undefined || lines[6] === undefined || lines[7] === undefined) {
        return null;
    }

    if (!/^ITEM:\s+ATOMS\b/.test(lines[8] ?? '')) {
        return null;
    }

    const requiredLineCount = 9 + atomCount;
    if (lines.length < requiredLineCount) {
        return null;
    }

    const frameLines = lines.slice(0, requiredLineCount);
    while (frameLines.length > 0 && frameLines[frameLines.length - 1]?.trim() === '') {
        frameLines.pop();
    }

    return {
        timestep,
        contents: `${frameLines.join('\n')}\n`
    };
};

const extractDumpFrameSegments = (contents: string): DumpFrameSegment[] => {
    const normalized = contents.replace(/\r\n/g, '\n');
    const frameMarkers = Array.from(normalized.matchAll(/^ITEM:\s+TIMESTEP\s*$/gm));
    const frames: DumpFrameSegment[] = [];

    for (let index = 0; index < frameMarkers.length; index += 1) {
        const start = frameMarkers[index]?.index;
        if (typeof start !== 'number') {
            continue;
        }

        const end = frameMarkers[index + 1]?.index ?? normalized.length;
        const parsed = parseDumpFrameSegment(normalized.slice(start, end));
        if (parsed) {
            frames.push(parsed);
        }
    }

    return frames;
};

export class LammpsDaemonService {
    private readonly activeExecutions = new Map<string, ActiveExecutionState>();

    constructor(
        private readonly dockerRuntimeService: DockerRuntimeService,
        private readonly objectStore: ClusterObjectStore,
        private readonly trajectoryParserService: TrajectoryParserService,
        private readonly glbExporterService: GlbExporterService,
        private readonly voltCloudConnection: VoltCloudConnection
    ) {}

    async provisionContainer(input: ProvisionLammpsContainerInput): Promise<ProvisionLammpsContainerResult> {
        try {
            const runtime = new VendorLammpsRuntime({
                docker: createHostAwareDockerClient()
            });
            const imageTag = buildHybridRuntimeImageTag(input.lammpsContainerId);
            const workspaceContainerName = input.workspaceContainerName
                || `volt-lammps-${sanitizeContainerName(input.name) || input.lammpsContainerId}`;
            const unsubscribe = this.attachBuildProgressListeners(runtime, input, imageTag);

            try {
                const buildResult = await runtime.build({
                    repository: 'volt/lammps-runtime',
                    imageTag,
                    packages: ensureOpenmpPackage(input.packages),
                    openmp: true
                });

                this.emitContainerProgress(ProgressStageType.Running, {
                    operationId: input.operationId,
                    lammpsContainerId: input.lammpsContainerId,
                    status: 'deploying',
                    step: 'creating-workspace-container',
                    imageTag: buildResult.tag,
                    imageHash: buildResult.hash
                });

                const workspaceContainer = await this.dockerRuntimeService.createContainer({
                    image: buildResult.tag,
                    name: workspaceContainerName,
                    cpus: input.cpus,
                    memoryInMegabytes: 4096,
                    cmd: ['sh', '-lc', `mkdir -p "${WORKSPACE_ROOT_PATH}" && tail -f /dev/null`],
                    labels: {
                        [LAMMPS_WORKSPACE_LABEL]: 'true',
                        [LAMMPS_CONTAINER_LABEL]: input.lammpsContainerId
                    }
                });

                await this.dockerRuntimeService.exec(
                    workspaceContainer.Id,
                    ['mkdir', '-p', '--', WORKSPACE_ROOT_PATH],
                    undefined,
                    { operationName: 'lammps-init-workspace', timeoutMs: 30_000 }
                );

                this.emitContainerProgress(ProgressStageType.Completed, {
                    operationId: input.operationId,
                    lammpsContainerId: input.lammpsContainerId,
                    status: 'ready',
                    step: 'workspace-ready',
                    imageTag: buildResult.tag,
                    imageHash: buildResult.hash,
                    workspaceContainerId: workspaceContainer.Id,
                    workspaceContainerName
                });

                return {
                    imageTag: buildResult.tag,
                    imageHash: buildResult.hash,
                    workspaceContainerId: workspaceContainer.Id,
                    workspaceContainerName,
                    workspaceRootPath: WORKSPACE_ROOT_PATH
                };
            } finally {
                unsubscribe();
            }
        } catch (error: unknown) {
            this.emitContainerProgress(ProgressStageType.Failed, {
                operationId: input.operationId,
                lammpsContainerId: input.lammpsContainerId,
                status: 'failed',
                step: 'provision-failed',
                message: toErrorMessage(error)
            });
            throw error;
        }
    }

    async removeWorkspaceContainer(input: { workspaceContainerId: string }): Promise<void> {
        await this.dockerRuntimeService.deleteContainer(input.workspaceContainerId);
    }

    async listFilesystem(input: LammpsFilesystemListInput) {
        return this.dockerRuntimeService.getContainerFiles(
            input.workspaceContainerId,
            normalizeContainerPath(input.targetPath)
        );
    }

    async readFile(input: LammpsFilesystemReadInput): Promise<{ contents: string }> {
        return {
            contents: await this.dockerRuntimeService.readContainerFile(
                input.workspaceContainerId,
                normalizeContainerPath(input.targetPath)
            )
        };
    }

    async writeFile(input: LammpsFilesystemWriteInput): Promise<void> {
        await this.dockerRuntimeService.writeContainerFile(
            input.workspaceContainerId,
            normalizeContainerPath(input.targetPath),
            input.content
        );
    }

    async writeFileBase64(input: LammpsFilesystemWriteBase64Input): Promise<void> {
        await this.dockerRuntimeService.writeContainerFile(
            input.workspaceContainerId,
            normalizeContainerPath(input.targetPath),
            Buffer.from(input.contentBase64, 'base64').toString('utf8')
        );
    }

    async createFile(input: LammpsFilesystemPathInput): Promise<void> {
        await this.dockerRuntimeService.writeContainerFile(
            input.workspaceContainerId,
            normalizeContainerPath(input.targetPath),
            ''
        );
    }

    async createDirectory(input: LammpsFilesystemPathInput): Promise<void> {
        await this.dockerRuntimeService.exec(
            input.workspaceContainerId,
            ['mkdir', '-p', '--', normalizeContainerPath(input.targetPath)],
            undefined,
            { operationName: 'lammps-create-directory', timeoutMs: 30_000 }
        );
    }

    async movePath(input: LammpsFilesystemMoveInput): Promise<void> {
        await this.dockerRuntimeService.exec(
            input.workspaceContainerId,
            ['mv', '--', normalizeContainerPath(input.targetPath), normalizeContainerPath(input.destinationPath)],
            undefined,
            { operationName: 'lammps-move-path', timeoutMs: 30_000 }
        );
    }

    async deletePath(input: LammpsFilesystemPathInput): Promise<void> {
        await this.dockerRuntimeService.exec(
            input.workspaceContainerId,
            ['rm', '-rf', '--', normalizeContainerPath(input.targetPath)],
            undefined,
            { operationName: 'lammps-delete-path', timeoutMs: 30_000 }
        );
    }

    async startRun(input: StartLammpsRunInput): Promise<StartLammpsRunResult> {
        const scratchDir = path.join(EXECUTION_SCRATCH_ROOT, input.executionId);
        const stagedProjectDir = path.join(scratchDir, 'project');
        const outputDir = path.join(scratchDir, 'output');

        await fs.rm(scratchDir, { recursive: true, force: true });
        await fs.mkdir(stagedProjectDir, { recursive: true });
        await fs.mkdir(outputDir, { recursive: true });

        this.emitRunProgress(ProgressStageType.Accepted, {
            executionId: input.executionId,
            scriptId: input.scriptId,
            status: 'starting',
            step: 'staging-project'
        });

        try {
            const runtime = new VendorLammpsRuntime({
                docker: createHostAwareDockerClient()
            });
            const activeExecution: ActiveExecutionState = {
                executionId: input.executionId,
                scriptId: input.scriptId,
                stagedTrajectoryId: input.stagedTrajectoryId,
                storageClusterId: input.storageClusterId,
                workspaceContainerId: input.workspaceContainerId,
                runtime,
                handle: null,
                runtimeRunId: null,
                scratchDir,
                outputDir,
                processedTimesteps: new Set<number>(),
                observedDumpFiles: new Map<string, number>(),
                pendingDumpTasks: new Set<Promise<void>>(),
                dumpPoller: null,
                dumpScanPromise: null,
                dumpScanQueued: false,
                eventUnsubscribers: []
            };
            this.activeExecutions.set(input.executionId, activeExecution);

            const stagedProject = await this.stageProjectFromWorkspace(
                input.workspaceContainerId,
                input.projectRootPath,
                input.entryFilePath,
                stagedProjectDir
            );

            activeExecution.eventUnsubscribers = this.attachRunEventListeners(runtime, activeExecution);
            this.startDumpPolling(activeExecution);
            const buildResult = await runtime.build({
                repository: 'volt/lammps-runtime',
                imageTag: input.imageTag,
                packages: ensureOpenmpPackage(input.packages),
                openmp: true
            });
            const totalCpuCount = input.mpiRanks * input.openmpThreads;

            const handle = await runtime.run({
                image: buildResult.tag,
                inputFile: stagedProject.entryFileHostPath,
                inputFiles: stagedProject.additionalInputHostPaths,
                outputDir,
                env: {
                    OMP_NUM_THREADS: String(input.openmpThreads)
                },
                resources: {
                    cpus: totalCpuCount
                },
                execution: {
                    mpiRanks: input.mpiRanks,
                    extraArgs: ['-pk', 'omp', String(input.openmpThreads), '-sf', 'omp']
                },
                labels: {
                    'volt.lammps.execution-id': input.executionId,
                    'volt.lammps.script-id': input.scriptId
                },
                dumpWatch: {
                    enabled: true,
                    patterns: ['*.dump', '*.lammpstrj', '*.traj', 'dump*'],
                    parseTimesteps: true
                },
                cleanup: {
                    removeContainer: true,
                    removeWorkspace: false
                }
            });

            activeExecution.handle = handle;
            activeExecution.runtimeRunId = handle.runId;

            this.emitRunProgress(ProgressStageType.Running, {
                executionId: input.executionId,
                scriptId: input.scriptId,
                runtimeRunId: handle.runId,
                status: 'running',
                step: 'run-created'
            });

            return {
                runtimeRunId: handle.runId
            };
        } catch (error: unknown) {
            this.emitRunProgress(ProgressStageType.Failed, {
                executionId: input.executionId,
                scriptId: input.scriptId,
                status: 'failed',
                step: 'run-start-failed',
                message: toErrorMessage(error)
            });
            await this.finalizeExecution(input.executionId);
            throw error;
        }
    }

    async stopRun(input: StopLammpsRunInput): Promise<void> {
        const execution = this.requireActiveExecution(input.executionId);
        if (!execution.handle) {
            throw new Error(`LAMMPS execution ${input.executionId} is not ready to stop`);
        }

        this.emitRunProgress(ProgressStageType.Running, {
            executionId: input.executionId,
            scriptId: execution.scriptId,
            runtimeRunId: execution.runtimeRunId,
            status: 'stopping',
            step: 'graceful-stop-requested'
        });
        await execution.handle.stop();
    }

    async killRun(input: StopLammpsRunInput): Promise<void> {
        const execution = this.requireActiveExecution(input.executionId);
        if (!execution.handle) {
            throw new Error(`LAMMPS execution ${input.executionId} is not ready to kill`);
        }

        this.emitRunProgress(ProgressStageType.Running, {
            executionId: input.executionId,
            scriptId: execution.scriptId,
            runtimeRunId: execution.runtimeRunId,
            status: 'killing',
            step: 'force-kill-requested'
        });
        await execution.handle.kill();
    }

    private requireActiveExecution(executionId: string): ActiveExecutionState {
        const execution = this.activeExecutions.get(executionId);
        if (!execution) {
            throw new Error(`LAMMPS execution ${executionId} is not active on this cluster`);
        }

        return execution;
    }

    private attachBuildProgressListeners(
        runtime: RuntimeInstance,
        input: ProvisionLammpsContainerInput,
        imageTag: string
    ): () => void {
        const unsubscribers = [
            runtime.on('build:start', (payload) => {
                this.emitContainerProgress(ProgressStageType.Running, {
                    operationId: input.operationId,
                    lammpsContainerId: input.lammpsContainerId,
                    status: 'building',
                    step: 'build-started',
                    imageTag,
                    imageHash: payload.hash,
                    message: `Building image ${payload.tag || imageTag}`
                });
            }),
            runtime.on('build:log', (payload) => {
                this.emitContainerProgress(ProgressStageType.Running, {
                    operationId: input.operationId,
                    lammpsContainerId: input.lammpsContainerId,
                    status: 'building',
                    step: 'build-log',
                    imageTag: payload.tag || imageTag,
                    imageHash: payload.hash,
                    message: payload.message
                });
            }),
            runtime.on('build:end', (payload) => {
                this.emitContainerProgress(ProgressStageType.Running, {
                    operationId: input.operationId,
                    lammpsContainerId: input.lammpsContainerId,
                    status: 'image-ready',
                    step: 'build-completed',
                    imageTag: payload.tag || imageTag,
                    imageHash: payload.hash
                });
            }),
            runtime.on('build:error', (payload) => {
                this.emitContainerProgress(ProgressStageType.Failed, {
                    operationId: input.operationId,
                    lammpsContainerId: input.lammpsContainerId,
                    status: 'failed',
                    step: 'build-error',
                    imageTag: payload.tag || imageTag,
                    imageHash: payload.hash,
                    message: payload.error
                });
            })
        ];

        return () => {
            for (const unsubscribe of unsubscribers) {
                unsubscribe();
            }
        };
    }

    private attachRunEventListeners(runtime: RuntimeInstance, execution: ActiveExecutionState): Array<() => void> {
        return [
            runtime.on('simulation:created', (payload) => {
                execution.runtimeRunId = payload.runId ?? execution.runtimeRunId;
                this.emitRunProgress(ProgressStageType.Running, {
                    executionId: execution.executionId,
                    scriptId: execution.scriptId,
                    runtimeRunId: payload.runId,
                    status: 'created',
                    outputDir: payload.outputDir,
                    snapshot: payload.snapshot ?? null
                });
            }),
            runtime.on('simulation:start', (payload) => {
                this.emitRunProgress(ProgressStageType.Running, {
                    executionId: execution.executionId,
                    scriptId: execution.scriptId,
                    runtimeRunId: payload.runId,
                    status: 'running',
                    step: 'container-started',
                    outputDir: payload.outputDir,
                    containerId: payload.containerId,
                    snapshot: payload.snapshot ?? null
                });
            }),
            runtime.on('simulation:stdout', (payload) => {
                this.emitRunProgress(ProgressStageType.Running, {
                    executionId: execution.executionId,
                    scriptId: execution.scriptId,
                    runtimeRunId: payload.runId,
                    kind: 'log',
                    stream: 'stdout',
                    line: payload.line
                });
            }),
            runtime.on('simulation:stderr', (payload) => {
                this.emitRunProgress(ProgressStageType.Running, {
                    executionId: execution.executionId,
                    scriptId: execution.scriptId,
                    runtimeRunId: payload.runId,
                    kind: 'log',
                    stream: 'stderr',
                    line: payload.line
                });
            }),
            runtime.on('simulation:state', (payload) => {
                this.emitRunProgress(
                    payload.state === 'completed' || payload.state === 'cancelled'
                        ? ProgressStageType.Completed
                        : payload.state === 'failed'
                            ? ProgressStageType.Failed
                            : ProgressStageType.Running,
                    {
                        executionId: execution.executionId,
                        scriptId: execution.scriptId,
                        runtimeRunId: payload.runId,
                        status: payload.state,
                        snapshot: payload.snapshot ?? null
                    }
                );
            }),
            runtime.on('simulation:error', (payload) => {
                this.emitRunProgress(ProgressStageType.Failed, {
                    executionId: execution.executionId,
                    scriptId: execution.scriptId,
                    runtimeRunId: payload.runId,
                    status: 'failed',
                    message: payload.error,
                    snapshot: payload.snapshot ?? null
                });
            }),
            runtime.on('simulation:end', (payload) => {
                this.emitRunProgress(
                    payload.exitCode === 0
                        ? ProgressStageType.Completed
                        : ProgressStageType.Failed,
                    {
                    executionId: execution.executionId,
                    scriptId: execution.scriptId,
                    runtimeRunId: payload.runId,
                    status: payload.exitCode === 0 ? 'completed' : 'failed',
                    exitCode: payload.exitCode,
                    snapshot: payload.snapshot ?? null
                    }
                );

                void this.finalizeExecution(execution.executionId);
            }),
            runtime.on('timestep', (payload) => {
                if (typeof payload.step !== 'number') {
                    return;
                }

                this.emitRunProgress(ProgressStageType.Running, {
                    executionId: execution.executionId,
                    scriptId: execution.scriptId,
                    runtimeRunId: payload.runId,
                    kind: 'timestep',
                    timestep: payload.step,
                    source: payload.message ?? 'runtime'
                });
            }),
            runtime.on('dump:detected', (payload) => {
                if (typeof payload.path !== 'string') {
                    return;
                }

                void this.requestDumpScan(execution.executionId);
            }),
            runtime.on('dump:frame', (payload) => {
                if (typeof payload.path !== 'string') {
                    return;
                }

                void this.requestDumpScan(execution.executionId);
            })
        ];
    }

    private startDumpPolling(execution: ActiveExecutionState): void {
        execution.dumpPoller = setInterval(() => {
            void this.requestDumpScan(execution.executionId);
        }, DUMP_SCAN_INTERVAL_MS);
    }

    private requestDumpScan(executionId: string): Promise<void> {
        const execution = this.activeExecutions.get(executionId);
        if (!execution) {
            return Promise.resolve();
        }

        if (execution.dumpScanPromise) {
            execution.dumpScanQueued = true;
            return execution.dumpScanPromise;
        }

        execution.dumpScanPromise = (async () => {
            try {
                do {
                    execution.dumpScanQueued = false;
                    await this.scanExecutionOutputForDumps(execution);
                } while (execution.dumpScanQueued);
            } finally {
                execution.dumpScanPromise = null;
            }
        })();

        return execution.dumpScanPromise;
    }

    private async scanExecutionOutputForDumps(
        execution: ActiveExecutionState,
        force = false
    ): Promise<void> {
        const dumpFiles = await this.collectDumpFiles(execution.outputDir);

        for (const dumpPath of dumpFiles) {
            const stats = await fs.stat(dumpPath).catch(() => null);
            if (!stats?.isFile()) {
                continue;
            }

            const previousSize = execution.observedDumpFiles.get(dumpPath);
            execution.observedDumpFiles.set(dumpPath, stats.size);

            if (!force && previousSize === stats.size) {
                continue;
            }

            const contents = await fs.readFile(dumpPath, 'utf8').catch(() => '');
            if (!contents) {
                continue;
            }

            const frames = extractDumpFrameSegments(contents);
            if (frames.length === 0) {
                continue;
            }

            const extractedFrameDirectory = path.join(execution.scratchDir, 'frames');
            await fs.mkdir(extractedFrameDirectory, { recursive: true });

            for (const frame of frames) {
                if (execution.processedTimesteps.has(frame.timestep)) {
                    continue;
                }

                const extractedFramePath = path.join(extractedFrameDirectory, `${frame.timestep}.dump`);
                await fs.writeFile(extractedFramePath, frame.contents, 'utf8');

                const dumpTask = this.processDumpFrame(execution.executionId, extractedFramePath, frame.timestep, {
                    cleanupSourceFile: true,
                    fileName: path.basename(dumpPath)
                }).finally(() => {
                    execution.pendingDumpTasks.delete(dumpTask);
                });
                execution.pendingDumpTasks.add(dumpTask);
            }
        }
    }

    private async collectDumpFiles(directoryPath: string): Promise<string[]> {
        const entries = await fs.readdir(directoryPath, { withFileTypes: true }).catch(() => []);
        const dumpFiles: string[] = [];

        for (const entry of entries) {
            const candidatePath = path.join(directoryPath, entry.name);
            if (entry.isDirectory()) {
                dumpFiles.push(...await this.collectDumpFiles(candidatePath));
                continue;
            }

            if (entry.isFile() && isDumpCandidatePath(candidatePath)) {
                dumpFiles.push(candidatePath);
            }
        }

        return dumpFiles;
    }

    private async processDumpFrame(
        executionId: string,
        dumpPath: string,
        timestep: number,
        options?: {
            cleanupSourceFile?: boolean;
            fileName?: string;
        }
    ): Promise<void> {
        const execution = this.activeExecutions.get(executionId);
        if (!execution || execution.processedTimesteps.has(timestep)) {
            if (options?.cleanupSourceFile) {
                await fs.unlink(dumpPath).catch(() => {});
            }
            return;
        }

        execution.processedTimesteps.add(timestep);

        try {
            await delay(DUMP_PROCESSING_SETTLE_MS);

            const dumpObjectKey = buildDumpObjectKey(execution.stagedTrajectoryId, timestep);
            const compressedDumpPath = `${dumpPath}.zst`;
            await compressFileWithZstd(dumpPath, compressedDumpPath);
            const dumpStats = await fs.stat(compressedDumpPath);

            await this.objectStore.putObjectStream({
                ownerClusterId: execution.storageClusterId,
                bucket: ObjectBucketName.Dumps,
                objectKey: dumpObjectKey,
                stream: createReadStream(compressedDumpPath),
                size: dumpStats.size,
                metadata: {
                    'Content-Type': 'chemical/x-lammps-dump',
                    'Content-Encoding': 'zstd'
                }
            });

            const parsedMetadata = await this.readDumpMetadata(dumpPath, timestep);
            await this.glbExporterService.preprocessTrajectory({
                trajectoryId: execution.stagedTrajectoryId,
                timestep,
                ownerClusterId: execution.storageClusterId,
                objectKey: dumpObjectKey
            });

            this.emitRunProgress(ProgressStageType.Running, {
                executionId: execution.executionId,
                scriptId: execution.scriptId,
                runtimeRunId: execution.runtimeRunId,
                kind: 'dump',
                status: 'ready',
                timestep,
                fileName: options?.fileName ?? path.basename(dumpPath),
                dumpObjectKey,
                modelObjectKey: this.trajectoryParserService.getModelObjectKey(execution.stagedTrajectoryId, timestep),
                storageClusterId: execution.storageClusterId,
                sizeBytes: dumpStats.size,
                natoms: parsedMetadata.natoms,
                simulationCell: parsedMetadata.simulationCell,
                exportedAt: createRuntimeTimestamp()
            });

            await fs.unlink(compressedDumpPath).catch(() => {});
        } catch (error: unknown) {
            execution.processedTimesteps.delete(timestep);
            this.emitRunProgress(ProgressStageType.Failed, {
                executionId: execution.executionId,
                scriptId: execution.scriptId,
                runtimeRunId: execution.runtimeRunId,
                kind: 'dump-error',
                status: 'failed',
                timestep,
                fileName: options?.fileName ?? path.basename(dumpPath),
                message: toErrorMessage(error)
            });
        } finally {
            if (options?.cleanupSourceFile) {
                await fs.unlink(dumpPath).catch(() => {});
            }
        }
    }

    private async readDumpMetadata(filePath: string, timestep: number): Promise<ParsedDumpMetadata> {
        const parsed = this.trajectoryParserService.parseTrajectory(filePath, {
            properties: []
        });

        return {
            timestep,
            natoms: parsed.metadata.natoms,
            simulationCell: parsed.metadata.simulationCell as Record<string, unknown> | null
        };
    }

    private async stageProjectFromWorkspace(
        workspaceContainerId: string,
        projectRootPath: string,
        entryFilePath: string,
        targetDirectory: string
    ): Promise<{
        entryFileHostPath: string;
        additionalInputHostPaths: string[];
    }> {
        const normalizedProjectRoot = normalizeContainerPath(projectRootPath);
        const normalizedEntrypoint = normalizeProjectPath(projectRootPath, entryFilePath);
        const files = await this.collectProjectFiles(workspaceContainerId, normalizedProjectRoot);

        if (!files.some((file) => file.containerPath === normalizedEntrypoint)) {
            throw new Error(`LAMMPS entry file "${normalizedEntrypoint}" was not found in the workspace container`);
        }

        const stagedFiles = [] as Array<{ containerPath: string; hostPath: string }>;

        for (const file of files) {
            const relativePath = path.posix.relative(normalizedProjectRoot, file.containerPath);
            const hostPath = path.join(targetDirectory, relativePath);
            const contents = await this.dockerRuntimeService.readContainerFile(
                workspaceContainerId,
                file.containerPath,
                {
                    operationName: 'lammps-stage-project-file',
                    timeoutMs: 120_000
                }
            );

            await fs.mkdir(path.dirname(hostPath), { recursive: true });
            await fs.writeFile(hostPath, contents, 'utf8');
            stagedFiles.push({
                containerPath: file.containerPath,
                hostPath
            });
        }

        const entryFileHostPath = stagedFiles.find((file) => file.containerPath === normalizedEntrypoint)?.hostPath;
        if (!entryFileHostPath) {
            throw new Error(`Failed to stage the LAMMPS entry file "${normalizedEntrypoint}"`);
        }

        return {
            entryFileHostPath,
            additionalInputHostPaths: stagedFiles
                .filter((file) => file.containerPath !== normalizedEntrypoint)
                .map((file) => file.hostPath)
        };
    }

    private async collectProjectFiles(
        workspaceContainerId: string,
        directoryPath: string
    ): Promise<Array<{ containerPath: string }>> {
        const entries = await this.dockerRuntimeService.getContainerFiles(
            workspaceContainerId,
            directoryPath,
            {
                operationName: 'lammps-list-project-directory',
                timeoutMs: 120_000
            }
        );
        const files: Array<{ containerPath: string }> = [];

        for (const entry of entries) {
            const childPath = path.posix.join(directoryPath, entry.name);
            if (entry.isDirectory) {
                files.push(...await this.collectProjectFiles(workspaceContainerId, childPath));
                continue;
            }

            files.push({ containerPath: childPath });
        }

        return files;
    }

    private async finalizeExecution(executionId: string): Promise<void> {
        const execution = this.activeExecutions.get(executionId);
        if (!execution) {
            return;
        }

        if (execution.dumpPoller) {
            clearInterval(execution.dumpPoller);
            execution.dumpPoller = null;
        }

        for (const unsubscribe of execution.eventUnsubscribers) {
            unsubscribe();
        }

        if (execution.dumpScanPromise) {
            await execution.dumpScanPromise;
        }

        await this.scanExecutionOutputForDumps(execution, true);

        if (execution.pendingDumpTasks.size > 0) {
            await Promise.allSettled(Array.from(execution.pendingDumpTasks));
        }

        this.activeExecutions.delete(executionId);
        await fs.rm(execution.scratchDir, { recursive: true, force: true }).catch(() => {});
    }

    private emitContainerProgress(stage: ProgressStageType, payload: Record<string, unknown>): void {
        this.voltCloudConnection.emitMessage({
            type: 'runtime-progress',
            action: OrchestrationAction.LammpsContainerProvision,
            stage,
            timestamp: createRuntimeTimestamp(),
            payload
        });
    }

    private emitRunProgress(stage: ProgressStageType, payload: Record<string, unknown>): void {
        this.voltCloudConnection.emitMessage({
            type: 'runtime-progress',
            action: OrchestrationAction.LammpsRun,
            stage,
            timestamp: createRuntimeTimestamp(),
            payload
        });
    }
}
