import type { TeamClusterDaemonExecutionLogSegment } from '@shared/contracts/types';
import type { PluginDebugSessionRegistryEntry } from '@modules/plugin/contracts/plugin/PluginDebugSessionRegistry';

export interface IPluginDebugSessionRegistryService {
    registerSession(sessionId: string, entry: PluginDebugSessionRegistryEntry): void;
    getSession(sessionId: string): PluginDebugSessionRegistryEntry | undefined;
    unregisterSession(sessionId: string): PluginDebugSessionRegistryEntry | undefined;
    unregisterSessionsForSocket(socketId: string): Array<[string, PluginDebugSessionRegistryEntry]>;
    listSessions(): Array<[string, PluginDebugSessionRegistryEntry]>;
    emitLogChunk(
        sessionId: string,
        expectedTeamClusterId: string,
        nodeId: string,
        segments: TeamClusterDaemonExecutionLogSegment[]
    ): boolean;
}
