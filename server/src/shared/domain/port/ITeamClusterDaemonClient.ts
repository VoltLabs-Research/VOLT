import type { Readable } from 'node:stream';
import type { ContainerTerminalAttachment } from '@modules/container/domain/port/IContainerService';

export interface TeamClusterDaemonCommandOptions {
    timeoutMs?: number;
    timeoutClass?: 'default' | 'interactive' | 'long-running-control-plane';
    retryClass?: 'none' | 'safe-read' | 'idempotent-command';
}

export interface TeamClusterDaemonSemanticCommandResult<T> {
    accepted: boolean;
    data: T;
    reason?: string;
    retryClass: NonNullable<TeamClusterDaemonCommandOptions['retryClass']>;
    timeoutClass: NonNullable<TeamClusterDaemonCommandOptions['timeoutClass']>;
}

export interface TeamClusterDaemonNotebookRuntime {
    tunnelTargetHost: string;
    tunnelTargetPort: number;
}

export interface TeamClusterDaemonNotebookRuntimeLookupResponse {
    runtime: TeamClusterDaemonNotebookRuntime | null;
}

export interface ITeamClusterDaemonClient {
    command<T>(
        teamClusterId: string,
        command: string,
        payload?: Record<string, unknown>,
        options?: TeamClusterDaemonCommandOptions
    ): Promise<T>;

    commandWithSemanticResult<T>(
        teamClusterId: string,
        command: string,
        payload?: Record<string, unknown>,
        options?: TeamClusterDaemonCommandOptions
    ): Promise<TeamClusterDaemonSemanticCommandResult<T>>;

    getNotebookRuntime(
        teamClusterId: string,
        notebookId: string
    ): Promise<TeamClusterDaemonNotebookRuntimeLookupResponse>;

    commandStream(
        teamClusterId: string,
        command: string,
        payload?: Record<string, unknown>
    ): Promise<Readable>;

    commandBuffer(
        teamClusterId: string,
        command: string,
        payload?: Record<string, unknown>
    ): Promise<Buffer>;
}
