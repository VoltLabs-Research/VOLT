import { SYSTEM_TOKENS } from '@modules/system/infrastructure/di/SystemTokens';
import {
    HARD_STORAGE_LIMIT_PCT,
    SOFT_STORAGE_ASSIGNMENT_PENALTY,
    SOFT_STORAGE_LIMIT_PCT
} from '@modules/team-cluster/application/services/cluster-storage-policy';
import {
    resolveEffectiveCapabilitiesFromRoleConfig,
    TeamClusterStatus
} from '@modules/team-cluster/domain/entities/TeamCluster';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';

import type { ISystemMetricsRepository } from '@modules/system/domain/port/ISystemMetricsRepository';
import type { SystemMetrics } from '@modules/system/domain/value-objects/SystemMetrics';
import type TeamCluster from '@modules/team-cluster/domain/entities/TeamCluster';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';

type SelectionCapability = 'compute' | 'storage';

interface ResolveRoleAwareClusterInput {
    teamId: string;
    requestedTeamClusterId?: string;
    preferredStorageClusterId?: string;
    preferredComputeClusterId?: string;
}

interface ScoredCluster {
    cluster: TeamCluster;
    score: number;
    metrics: SystemMetrics | null;
}

const NETWORK_USAGE_SATURATION_KBPS = 25_000;
const REMOTE_EXECUTION_PENALTY = 20;
const REMOTE_STORAGE_PENALTY = 8;
const HARD_STORAGE_ASSIGNMENT_PENALTY = 100;

const buildMissingClusterError = (capability: SelectionCapability): ApplicationError => {
    if (capability === 'storage') {
        return ApplicationError.conflict(
            'TeamCluster::StorageClusterRequired',
            'A connected storage-capable team cluster is required for this operation'
        );
    }

    return ApplicationError.conflict(
        'TeamCluster::ComputeClusterRequired',
        'A connected compute-capable team cluster is required for this operation'
    );
};

const buildMissingConnectedClusterError = (): ApplicationError => {
    return ApplicationError.conflict(
        'TeamCluster::ConnectedClusterRequired',
        'A connected team cluster is required for this operation'
    );
};

const buildCapabilityMismatchError = (
    capability: SelectionCapability
): ApplicationError => {
    if (capability === 'storage') {
        return ApplicationError.conflict(
            'TeamCluster::StorageCapabilityRequired',
            'The requested team cluster cannot accept storage ownership for this operation'
        );
    }

    return ApplicationError.conflict(
        'TeamCluster::ComputeCapabilityRequired',
        'The requested team cluster cannot accept compute work for this operation'
    );
};

const normalizePercent = (value: unknown): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 50;
    }

    return Math.min(100, Math.max(0, value));
};

const normalizeNetworkUsage = (metrics: SystemMetrics | null): number => {
    if (!metrics) {
        return 50;
    }

    const totalKb = typeof metrics.network.total === 'number' && Number.isFinite(metrics.network.total)
        ? metrics.network.total
        : 0;

    return Math.min(100, Math.max(0, (totalKb / NETWORK_USAGE_SATURATION_KBPS) * 100));
};

const supportsCapability = (
    cluster: TeamCluster,
    capability: SelectionCapability
): boolean => {
    if (cluster.props.status !== TeamClusterStatus.Connected) {
        return false;
    }

    const derivedCapabilities = resolveEffectiveCapabilitiesFromRoleConfig(
        cluster.props.roleConfig
    );

    if (capability === 'storage') {
        return derivedCapabilities.acceptsStorageWrites;
    }

    return derivedCapabilities.acceptsComputeJobs;
};

@injectable()
export class ClusterRoleAwareSelectionService {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(SYSTEM_TOKENS.SystemMetricsRepository)
        private readonly systemMetricsRepository: ISystemMetricsRepository
    ) {}

    async resolveStorageCluster(
        input: ResolveRoleAwareClusterInput
    ): Promise<TeamCluster> {
        return this.resolveCluster('storage', input);
    }

    async resolveStorageClusterId(
        input: ResolveRoleAwareClusterInput
    ): Promise<string> {
        const cluster = await this.resolveStorageCluster(input);
        return cluster.id;
    }

    async resolveComputeCluster(
        input: ResolveRoleAwareClusterInput
    ): Promise<TeamCluster> {
        return this.resolveCluster('compute', input);
    }

    async resolveComputeClusterId(
        input: ResolveRoleAwareClusterInput
    ): Promise<string> {
        const cluster = await this.resolveComputeCluster(input);
        return cluster.id;
    }

    async resolveConnectedCluster(
        input: ResolveRoleAwareClusterInput
    ): Promise<TeamCluster> {
        if (input.requestedTeamClusterId) {
            const requestedTeamCluster = await this.teamClusterRepository.findById(input.requestedTeamClusterId);
            if (!requestedTeamCluster || requestedTeamCluster.props.team !== input.teamId) {
                throw ApplicationError.notFound(
                    'TeamCluster::NotFound',
                    'Team cluster not found for the requested team'
                );
            }

            if (requestedTeamCluster.props.status !== TeamClusterStatus.Connected) {
                throw buildMissingConnectedClusterError();
            }

            return requestedTeamCluster;
        }

        const teamClusters = await this.teamClusterRepository.export({
            filter: {
                team: input.teamId,
                status: TeamClusterStatus.Connected
            },
            sort: {
                createdAt: 1
            }
        });

        if (!teamClusters.length) {
            throw buildMissingConnectedClusterError();
        }

        const scoredCandidates: ScoredCluster[] = await Promise.all(teamClusters.map(async (cluster) => {
            const metrics = await this.systemMetricsRepository.getLatestByClusterId(cluster.id);
            return {
                cluster,
                score: this.computeClusterScore(
                    'compute',
                    cluster,
                    metrics,
                    input
                ),
                metrics
            };
        }));

        scoredCandidates.sort((left, right) => {
            if (right.score !== left.score) {
                return right.score - left.score;
            }

            const leftHasMetrics = left.metrics ? 1 : 0;
            const rightHasMetrics = right.metrics ? 1 : 0;
            if (rightHasMetrics !== leftHasMetrics) {
                return rightHasMetrics - leftHasMetrics;
            }

            return left.cluster.props.createdAt.getTime() - right.cluster.props.createdAt.getTime();
        });

        const selectedCluster = scoredCandidates[0]?.cluster;
        if (!selectedCluster) {
            throw buildMissingConnectedClusterError();
        }

        return selectedCluster;
    }

    async resolveConnectedClusterId(
        input: ResolveRoleAwareClusterInput
    ): Promise<string> {
        const cluster = await this.resolveConnectedCluster(input);
        return cluster.id;
    }

    private async resolveCluster(
        capability: SelectionCapability,
        input: ResolveRoleAwareClusterInput
    ): Promise<TeamCluster> {
        if (input.requestedTeamClusterId) {
            const requestedTeamCluster = await this.teamClusterRepository.findById(input.requestedTeamClusterId);
            if (!requestedTeamCluster || requestedTeamCluster.props.team !== input.teamId) {
                throw ApplicationError.notFound(
                    'TeamCluster::NotFound',
                    'Team cluster not found for the requested team'
                );
            }

            if (requestedTeamCluster.props.status !== TeamClusterStatus.Connected) {
                throw buildMissingClusterError(capability);
            }

            if (!supportsCapability(requestedTeamCluster, capability)) {
                throw buildCapabilityMismatchError(capability);
            }

            return requestedTeamCluster;
        }

        const teamClusters = await this.teamClusterRepository.export({
            filter: {
                team: input.teamId,
                status: TeamClusterStatus.Connected
            },
            sort: {
                createdAt: 1
            }
        });

        const candidates = teamClusters.filter((cluster) => supportsCapability(cluster, capability));
        if (!candidates.length) {
            throw buildMissingClusterError(capability);
        }

        const scoredCandidates: ScoredCluster[] = await Promise.all(candidates.map(async (cluster) => {
            const metrics = await this.systemMetricsRepository.getLatestByClusterId(cluster.id);
            return {
                cluster,
                score: this.computeClusterScore(
                    capability,
                    cluster,
                    metrics,
                    input
                ),
                metrics
            };
        }));

        scoredCandidates.sort((left, right) => {
            if (right.score !== left.score) {
                return right.score - left.score;
            }

            const leftHasMetrics = left.metrics ? 1 : 0;
            const rightHasMetrics = right.metrics ? 1 : 0;
            if (rightHasMetrics !== leftHasMetrics) {
                return rightHasMetrics - leftHasMetrics;
            }

            return left.cluster.props.createdAt.getTime() - right.cluster.props.createdAt.getTime();
        });

        const selectedCluster = scoredCandidates[0]?.cluster;
        if (!selectedCluster) {
            throw buildMissingClusterError(capability);
        }

        return selectedCluster;
    }

    private computeClusterScore(
        capability: SelectionCapability,
        cluster: TeamCluster,
        metrics: SystemMetrics | null,
        input: ResolveRoleAwareClusterInput
    ): number {
        const cpuUsage = normalizePercent(metrics?.cpu.usage);
        const memoryUsage = normalizePercent(metrics?.memory.usagePercent);
        const diskUsage = normalizePercent(metrics?.disk.usagePercent);
        const networkUsage = normalizeNetworkUsage(metrics);

        let score = 100
            - (cpuUsage * 0.45)
            - (memoryUsage * 0.30)
            - (diskUsage * 0.15)
            - (networkUsage * 0.10);

        if (capability === 'compute'
            && input.preferredStorageClusterId
            && input.preferredStorageClusterId !== cluster.id) {
            score -= REMOTE_EXECUTION_PENALTY;
        }

        if (capability === 'storage'
            && input.preferredComputeClusterId
            && input.preferredComputeClusterId !== cluster.id) {
            score -= REMOTE_STORAGE_PENALTY;
        }

        if (capability === 'storage' && diskUsage >= SOFT_STORAGE_LIMIT_PCT) {
            score -= SOFT_STORAGE_ASSIGNMENT_PENALTY;
        }

        if (capability === 'storage' && diskUsage >= HARD_STORAGE_LIMIT_PCT) {
            score -= HARD_STORAGE_ASSIGNMENT_PENALTY;
        }

        return score;
    }
}
