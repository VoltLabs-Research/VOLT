
import type Docker from 'dockerode';

import type { EnvVariable, PortMapping, ContainerFile } from '@volt/contracts/modules/container/domain';
import type { ContainerProcessInfo } from '@volt/contracts/modules/container/domain';
export type { ContainerProcessInfo };

export type ContainerEnvironmentVariable = EnvVariable;
export type ContainerPortMapping = PortMapping;

export interface CreateRuntimeContainerOptions {
    image: string;
    name: string;
    operationId?: string;
    user?: string;
    env?: ContainerEnvironmentVariable[];
    ports?: ContainerPortMapping[];
    labels?: Record<string, string>;
    memoryInMegabytes: number;
    cpus: number;
    binds?: string[];
    groupAdd?: string[];
    cmd?: string[];
}

export type ContainerStats = Docker.ContainerStats;
export type RuntimeContainerInfo = Docker.ContainerInspectInfo;

export type ContainerFileEntry = ContainerFile;

export interface ContainerTerminalSize {
    rows: number;
    cols: number;
}

export interface ContainerTerminalStream {
    destroyed?: boolean;
    write(input: string): void;
    destroy(): void;
    removeAllListeners(event?: string): void;
    on(event: 'data', listener: (chunk: Buffer) => void): void;
    on(event: 'end', listener: () => void): void;
    on(event: 'error', listener: (error: Error) => void): void;
}

export interface ContainerTerminalExec {
    resize(size: ContainerTerminalSize): Promise<void>;
}

export interface ContainerTerminalAttachment {
    stream: ContainerTerminalStream;
    exec: ContainerTerminalExec;
    close(): Promise<void>;
}
