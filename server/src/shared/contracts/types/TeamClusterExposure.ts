/**
 * Neutral, cross-module TYPE/ENUM contracts for team-cluster service exposures
 * (services a connected daemon publishes for tunneling) and daemon execution-log
 * segments.
 *
 * Extracted during the detachable-modules migration so consumers in the
 * scripting, container, plugin and analysis modules (and shared services) can
 * reference these shapes without importing `@modules/cluster`. The four
 * `TeamClusterServiceExposure*` symbols were previously defined in
 * `@modules/cluster/contracts/TeamClusterServiceExposure`;
 * `TeamClusterDaemonExecutionLogSegment` was previously defined in
 * `@modules/cluster/utilities/teamClusterSocket`. Both original files now
 * re-export from here so existing importers compile and (for the nominal enums)
 * stay type-identical.
 *
 * This file imports no `@modules/*` code.
 */

/**
 * Describes a public access mode supported by a team cluster service exposure.
 */
export enum TeamClusterServiceExposureAccessMode {
    Http = 'http',
    Tcp = 'tcp',
    WebSocket = 'websocket'
}

/**
 * Describes the operational state of an exposure registered by a team cluster daemon.
 */
export enum TeamClusterServiceExposureStatus {
    Active = 'active',
    Unavailable = 'unavailable'
}

/**
 * Describes where a team cluster service exposure originates.
 */
export enum TeamClusterServiceExposureSourceKind {
    Container = 'container',
    Daemon = 'daemon'
}

/**
 * Represents a single persistent service exposure published by a team cluster daemon.
 */
export interface TeamClusterServiceExposure {
    id: string;
    teamClusterId: string;
    teamId: string;
    sourceKind: TeamClusterServiceExposureSourceKind;
    exposureName: string;
    accessModes: TeamClusterServiceExposureAccessMode[];
    targetHost: string;
    targetPort: number;
    status: TeamClusterServiceExposureStatus;
    labels: Record<string, string>;
    containerId?: string;
    containerName?: string;
    containerPort?: number;
}

/**
 * A single chunk of a team cluster daemon's execution log, tagged with the
 * stream it came from and (optionally) the workflow node that produced it.
 */
export interface TeamClusterDaemonExecutionLogSegment {
    stream: 'stdout' | 'stderr' | 'system';
    text: string;
    occurredAt: string;
    nodeId?: string;
    nodeType?: string;
    nodeLabel?: string;
    pluginId?: string;
    executionPath?: string[];
}
