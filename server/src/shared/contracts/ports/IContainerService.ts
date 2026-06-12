/**
 * Neutral, cross-module service-port contract for the Container domain.
 * Extracted from `@modules/container/domain/port/IContainerService` during the
 * detachable-modules migration so consumers (the cluster module consumes the
 * terminal types) depend on a contract rather than `@modules/container`.
 *
 * Pure type — no runtime footprint, no `@modules/*` import. The owner module
 * re-exports every name below so existing importers compile unchanged.
 */
import type Docker from 'dockerode';

export interface ContainerEnvironmentVariable {
    key: string;
    value: string;
}

export interface ContainerPortMapping {
    private: number;
    public?: number;
}

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

export type ContainerProcessInfo = Record<string, unknown>;

export type ContainerStats = Docker.ContainerStats;
export type RuntimeContainerInfo = Docker.ContainerInspectInfo;

export interface ContainerFileEntry {
    name: string;
    isDirectory: boolean;
    size: string;
    permissions: string;
    owner: string;
    group: string;
    date: string;
}

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
