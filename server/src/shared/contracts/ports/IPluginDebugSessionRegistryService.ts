/**
 * Neutral, cross-module port for the plugin debug-session registry — the
 * in-memory map of active plugin-debug sessions a connected daemon streams
 * node log chunks into. Scoped to the surface consumed OUTSIDE the plugin
 * module: the cluster socket module fans inbound daemon debug-log chunks out to
 * the originating client socket via `emitLogChunk`.
 *
 * Extracted during the detachable-modules migration so the cluster module can
 * stop importing the concrete `@modules/plugin` service. The concrete
 * `PluginDebugSessionRegistryService` stays in the plugin module, registered
 * under `PLUGIN_CONTRACT_TOKENS.PluginDebugSessionRegistryService`; the cluster
 * consumer `@inject(...)`s against this port without importing `@modules/plugin`.
 *
 * The richer plugin-internal surface (registerSession / getSession /
 * unregisterSession / unregisterSessionsForSocket / listSessions) lives on
 * `@modules/plugin/domain/port/plugin/IPluginDebugSessionRegistryService` and is
 * intentionally NOT mirrored here — this port exposes only what cross-module
 * consumers call.
 *
 * This file imports no `@modules/*` code: the log-segment type comes from the
 * neutral `shared/contracts/types` layer.
 */
import type { TeamClusterDaemonExecutionLogSegment } from '@shared/contracts/types';

export interface IPluginDebugSessionRegistryService {
    emitLogChunk(
        sessionId: string,
        expectedTeamClusterId: string,
        nodeId: string,
        segments: TeamClusterDaemonExecutionLogSegment[]
    ): boolean;
}
