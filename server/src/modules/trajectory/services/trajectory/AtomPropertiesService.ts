import teamClusterDaemonClient from '@modules/cluster/services/team-cluster/TeamClusterDaemonClient';
import { ErrorCodes } from '@core/constants/error-codes';
import {
    buildExposureAtomConfig,
    getExposureNodes,
    getLineExposureIds,
    requireAnalysisExposureContext,
    requireExposureNode,
    resolveAnalysisClusterContext
} from '@modules/trajectory/services/trajectory/exposure-atom-properties';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ChannelCommands } from '@shared/contracts/types/team-cluster-daemon-channel';

import type { ExposureAtomConfig } from '@modules/trajectory/services/trajectory/exposure-atom-properties';

export interface FilterExpression {
    property: string;
    operator: '==' | '!=' | '>' | '>=' | '<' | '<=';
    value: number | string;
}

class AtomPropertiesService {
    async getAnalysisExposureAtomConfigs(analysisId: string, timestep?: string): Promise<ExposureAtomConfig[]> {
        const context = await requireAnalysisExposureContext(analysisId);
        const lineExposureIds = getLineExposureIds(context.plugin);
        const exposureNodes = getExposureNodes(context.plugin)
            .filter((node) => !lineExposureIds.has(node.id));
        const configs: ExposureAtomConfig[] = [];

        for (const exposureNode of exposureNodes) {
            configs.push(await buildExposureAtomConfig(analysisId, context, exposureNode, timestep));
        }

        return configs;
    }

    async buildPluginIndexForAtomIds(
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep: string,
        targetIds: Set<number>
    ): Promise<Map<number, Record<string, unknown>> | null> {
        if (targetIds.size === 0) return null;

        const context = await requireAnalysisExposureContext(analysisId);
        const exposureNode = requireExposureNode(context.plugin, exposureId);
        const config = await buildExposureAtomConfig(analysisId, context, exposureNode);
        if (config.perAtomProperties.length === 0) return null;

        const rawIndex = await teamClusterDaemonClient.command<Record<string, Record<string, unknown>> | null>(
            context.teamClusterId,
            ChannelCommands.TrajectoryPluginAtomIndex,
            {
                trajectoryId,
                analysisId,
                exposureId,
                timestep: Number(timestep),
                targetIds: Array.from(targetIds),
                ownerClusterId: context.ownerClusterId
            }
        );

        if (!rawIndex) return null;

        const pluginIndex = new Map<number, Record<string, unknown>>();
        for (const [key, value] of Object.entries(rawIndex)) {
            pluginIndex.set(Number(key), value);
        }

        return pluginIndex.size > 0 ? pluginIndex : null;
    }

    async assertExposurePublishesProperty(
        analysisId: string,
        exposureId: string,
        timestep: string,
        property: string
    ): Promise<void> {
        const exposureConfigs = await this.getAnalysisExposureAtomConfigs(analysisId, timestep);
        const exposureConfig = exposureConfigs.find((config) => config.exposureId === exposureId);

        if (!exposureConfig || !exposureConfig.perAtomProperties.includes(property)) {
            throw ApplicationError.badRequest(
                ErrorCodes.PARTICLE_FILTER_PLUGIN_PROPERTY_UNAVAILABLE,
                `Plugin per-atom property "${property}" is not available for exposure "${exposureId}" at timestep ${timestep}`
            );
        }
    }

    async getModifierStats(
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep: string,
        property: string
    ): Promise<{ min: number; max: number } | undefined> {
        const context = await resolveAnalysisClusterContext(analysisId);
        if (!context.teamClusterId) return undefined;

        const result = await teamClusterDaemonClient.command<{ min: number; max: number } | null>(
            context.teamClusterId,
            ChannelCommands.TrajectoryPluginModifierStats,
            {
                trajectoryId,
                analysisId,
                exposureId,
                timestep: Number(timestep),
                property,
                ownerClusterId: context.ownerClusterId
            }
        );

        return result ?? undefined;
    }

    async getModifierUniqueValues(
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep: string,
        property: string,
        maxValues: number = 100
    ): Promise<Array<number | string>> {
        const context = await resolveAnalysisClusterContext(analysisId);
        if (!context.teamClusterId) return [];

        const result = await teamClusterDaemonClient.command<Array<number | string> | null>(
            context.teamClusterId,
            ChannelCommands.TrajectoryPluginModifierUniqueValues,
            {
                trajectoryId,
                analysisId,
                exposureId,
                timestep: Number(timestep),
                property,
                maxValues,
                ownerClusterId: context.ownerClusterId
            }
        );

        return result ?? [];
    }
}

export default new AtomPropertiesService();
