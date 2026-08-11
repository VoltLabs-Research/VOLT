
import type { TeamClusterDaemonExecutionLogSegment } from '@shared/contracts/types/TeamClusterExposure';

export interface IPluginDebugSessionRegistryService {
    emitLogChunk(
        sessionId: string,
        expectedTeamClusterId: string,
        nodeId: string,
        segments: TeamClusterDaemonExecutionLogSegment[]
    ): boolean;
}
