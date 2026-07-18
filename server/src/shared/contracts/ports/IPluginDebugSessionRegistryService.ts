
import type { TeamClusterDaemonExecutionLogSegment } from '@shared/contracts/types';

export interface IPluginDebugSessionRegistryService {
    emitLogChunk(
        sessionId: string,
        expectedTeamClusterId: string,
        nodeId: string,
        segments: TeamClusterDaemonExecutionLogSegment[]
    ): boolean;
}
