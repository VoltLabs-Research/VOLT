import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import type { TeamClusterDaemonExecutionLogSegment } from '@modules/team-cluster/utilities/teamClusterSocket';
import { Singleton } from '@shared/infrastructure/di/decorators';

export interface PluginDebugSessionRegistryEntry {
    socketId: string;
    teamClusterId: string;
}

@Singleton()
export default class PluginDebugSessionRegistryService {
    private readonly sessions = new Map<string, PluginDebugSessionRegistryEntry>();

    constructor(
        
        private readonly emitter: SocketIOEmitter
    ) {}

    registerSession(sessionId: string, entry: PluginDebugSessionRegistryEntry): void {
        this.sessions.set(sessionId, entry);
    }

    getSession(sessionId: string): PluginDebugSessionRegistryEntry | undefined {
        return this.sessions.get(sessionId);
    }

    unregisterSession(sessionId: string): PluginDebugSessionRegistryEntry | undefined {
        const entry = this.sessions.get(sessionId);
        this.sessions.delete(sessionId);
        return entry;
    }

    unregisterSessionsForSocket(socketId: string): Array<[string, PluginDebugSessionRegistryEntry]> {
        const removed: Array<[string, PluginDebugSessionRegistryEntry]> = [];

        for (const [sessionId, entry] of this.sessions.entries()) {
            if (entry.socketId !== socketId) {
                continue;
            }

            removed.push([sessionId, entry]);
            this.sessions.delete(sessionId);
        }

        return removed;
    }

    listSessions(): Array<[string, PluginDebugSessionRegistryEntry]> {
        return Array.from(this.sessions.entries());
    }

    emitLogChunk(
        sessionId: string,
        expectedTeamClusterId: string,
        nodeId: string,
        segments: TeamClusterDaemonExecutionLogSegment[]
    ): boolean {
        const entry = this.sessions.get(sessionId);
        if (!entry || entry.teamClusterId !== expectedTeamClusterId) {
            return false;
        }

        this.emitter.emitToSocket(entry.socketId, 'debug:node:log-chunk', {
            sessionId,
            nodeId,
            segments
        });

        return true;
    }
}
