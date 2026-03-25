import { ErrorCodes } from '@core/constants/error-codes';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowNode';
import { IPluginRepository } from '@modules/plugin/domain/port/plugin/IPluginRepository';
import {
    resolveAnalysisComputeClusterId,
    resolveAnalysisStorageClusterId
} from '@modules/team-cluster/application/utilities/cluster-location';
import { IAtomPropertiesService, ExposureAtomConfig, AnalysisAllAtomsResult } from '@modules/trajectory/domain/port/trajectory/IAtomPropertiesService';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import Analysis from '@modules/analysis/domain/entities/Analysis';
import Plugin from '@modules/plugin/domain/entities/plugin/Plugin';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import { injectable, inject } from 'tsyringe';

@injectable()
export default class AtomPropertiesService implements IAtomPropertiesService {
    constructor(
        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly daemonClient: TeamClusterDaemonClient,

        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository,

        @inject(PLUGIN_TOKENS.PluginRepository)
        private readonly pluginRepository: IPluginRepository
    ) { }

    async getModifierPerAtomProps(analysisId: string, timestep?: string): Promise<Record<string, string[]>> {
        const exposureConfigs = await this.getAnalysisExposureAtomConfigs(analysisId, timestep);
        const props: Record<string, string[]> = {};

        for (const config of exposureConfigs) {
            if (config.perAtomProperties.length > 0) {
                props[config.exposureId] = config.perAtomProperties;
            }
        }

        return props;
    }

    async getAnalysisExposureAtomConfigs(analysisId: string, timestep?: string): Promise<ExposureAtomConfig[]> {
        const { analysis, plugin } = await this.getAnalysisAndPlugin(analysisId);
        const trajectoryId = analysis.props.trajectory;
        const teamClusterId = resolveAnalysisComputeClusterId(analysis.props);
        const ownerClusterId = this.requireAnalysisStorageClusterId(analysis);

        if (!teamClusterId) {
            throw new ApplicationError(ErrorCodes.TEAM_CLUSTER_NOT_FOUND, ErrorCodes.TEAM_CLUSTER_NOT_FOUND, 404);
        }

        const exposureNodes = this.getExposureNodes(plugin);
        const configs: ExposureAtomConfig[] = [];

        for (const exposureNode of exposureNodes) {
            const exposureId = String(exposureNode.id);
            const perAtomProperties = await this.getPerAtomProperties(
                teamClusterId,
                trajectoryId,
                analysisId,
                exposureId,
                timestep,
                ownerClusterId
            );

            configs.push({
                exposureId,
                exposureName: this.getExposureName(exposureNode),
                perAtomProperties,
                schemaKeysMap: new Map()
            });
        }

        return configs;
    }

    async getExposureAtomConfig(analysisId: string, exposureId: string): Promise<ExposureAtomConfig> {
        const { analysis, plugin } = await this.getAnalysisAndPlugin(analysisId);
        const trajectoryId = analysis.props.trajectory;
        const teamClusterId = resolveAnalysisComputeClusterId(analysis.props);
        const ownerClusterId = this.requireAnalysisStorageClusterId(analysis);

        if (!teamClusterId) {
            throw new ApplicationError(ErrorCodes.TEAM_CLUSTER_NOT_FOUND, ErrorCodes.TEAM_CLUSTER_NOT_FOUND, 404);
        }

        const exposureNode = this.getExposureNodes(plugin)
            .find((node) => String(node.id) === String(exposureId));

        if (!exposureNode) throw new ApplicationError(ErrorCodes.PLUGIN_NODE_NOT_FOUND, ErrorCodes.PLUGIN_NODE_NOT_FOUND, 404);

        const perAtomProperties = await this.getPerAtomProperties(
            teamClusterId,
            trajectoryId,
            analysisId,
            String(exposureId),
            undefined,
            ownerClusterId
        );

        return {
            exposureId: String(exposureId),
            exposureName: this.getExposureName(exposureNode),
            perAtomProperties,
            schemaKeysMap: new Map()
        };
    }

    async getAnalysisAllPerAtomProperties(
        teamClusterId: string,
        trajectoryId: string,
        analysisId: string,
        timestep: string
    ): Promise<AnalysisAllAtomsResult | null> {
        const analysis = await this.analysisRepository.findById(analysisId);
        if (!analysis) {
            return null;
        }
        const ownerClusterId = this.requireAnalysisStorageClusterId(analysis);

        return this.daemonClient.command<AnalysisAllAtomsResult | null>(
            teamClusterId,
            'trajectory.plugin.analysis-all-atoms',
            {
                trajectoryId,
                analysisId,
                timestep: Number(timestep),
                ownerClusterId
            }
        );
    }

    async buildPluginIndexForAtomIds(
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep: string,
        targetIds: Set<number>
    ): Promise<Map<number, Record<string, unknown>> | null> {
        if (targetIds.size === 0) return null;

        const config = await this.getExposureAtomConfig(analysisId, exposureId);
        if (config.perAtomProperties.length === 0) return null;

        const { analysis } = await this.getAnalysisAndPlugin(analysisId);
        const teamClusterId = resolveAnalysisComputeClusterId(analysis.props);
        const ownerClusterId = this.requireAnalysisStorageClusterId(analysis);

        if (!teamClusterId) {
            throw new ApplicationError(ErrorCodes.TEAM_CLUSTER_NOT_FOUND, ErrorCodes.TEAM_CLUSTER_NOT_FOUND, 404);
        }

        const rawIndex = await this.daemonClient.command<Record<string, Record<string, unknown>> | null>(
            teamClusterId,
            'trajectory.plugin.atom-index',
            {
                trajectoryId,
                analysisId,
                exposureId,
                timestep: Number(timestep),
                targetIds: Array.from(targetIds),
                ownerClusterId
            }
        );

        if (!rawIndex) return null;

        const pluginIndex = new Map<number, Record<string, unknown>>();
        for (const [key, value] of Object.entries(rawIndex)) {
            pluginIndex.set(Number(key), value);
        }

        return pluginIndex.size > 0 ? pluginIndex : null;
    }

    async getModifierValues(
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep: string,
        property: string
    ): Promise<Float32Array | undefined> {
        const { analysis } = await this.getAnalysisAndPlugin(analysisId);
        const teamClusterId = resolveAnalysisComputeClusterId(analysis.props);
        const ownerClusterId = this.requireAnalysisStorageClusterId(analysis);

        if (!teamClusterId) return undefined;

        const result = await this.daemonClient.command<Record<number, number> | number[] | null>(
            teamClusterId,
            'trajectory.plugin.modifier-values',
            {
                trajectoryId,
                analysisId,
                exposureId,
                timestep: Number(timestep),
                property,
                ownerClusterId
            }
        );

        if (!result) return undefined;

        if (Array.isArray(result)) {
            return new Float32Array(result);
        }

        // If received as an object map from msgpack/json
        const length = Object.keys(result).length;
        const arr = new Float32Array(length);
        for (let i = 0; i < length; i++) {
            arr[i] = result[i] || 0;
        }
        return arr;
    }

    async getModifierStats(
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep: string,
        property: string
    ): Promise<{ min: number; max: number } | undefined> {
        const { analysis } = await this.getAnalysisAndPlugin(analysisId);
        const teamClusterId = resolveAnalysisComputeClusterId(analysis.props);
        const ownerClusterId = this.requireAnalysisStorageClusterId(analysis);

        if (!teamClusterId) return undefined;

        const result = await this.daemonClient.command<{ min: number; max: number } | null>(
            teamClusterId,
            'trajectory.plugin.modifier-stats',
            {
                trajectoryId,
                analysisId,
                exposureId,
                timestep: Number(timestep),
                property,
                ownerClusterId
            }
        );

        return result || undefined;
    }

    async getModifierUniqueValues(
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep: string,
        property: string,
        maxValues: number = 100
    ): Promise<number[]> {
        const { analysis } = await this.getAnalysisAndPlugin(analysisId);
        const teamClusterId = resolveAnalysisComputeClusterId(analysis.props);
        const ownerClusterId = this.requireAnalysisStorageClusterId(analysis);

        if (!teamClusterId) return [];

        const result = await this.daemonClient.command<number[] | null>(
            teamClusterId,
            'trajectory.plugin.modifier-unique-values',
            {
                trajectoryId,
                analysisId,
                exposureId,
                timestep: Number(timestep),
                property,
                maxValues,
                ownerClusterId
            }
        );

        return result || [];
    }

    private async getAnalysisAndPlugin(analysisId: string): Promise<{ analysis: Analysis; plugin: Plugin }> {
        const analysis = await this.analysisRepository.findById(analysisId);
        if (!analysis) throw new ApplicationError(ErrorCodes.ANALYSIS_NOT_FOUND, ErrorCodes.ANALYSIS_NOT_FOUND, 404);

        const plugin = await this.pluginRepository.findById(analysis.props.plugin);
        if (!plugin) throw new ApplicationError(ErrorCodes.PLUGIN_NOT_FOUND, ErrorCodes.PLUGIN_NOT_FOUND, 404);

        return { analysis, plugin };
    }

    private getExposureNodes(plugin: Plugin) {
        return plugin.props.workflow.props.nodes.filter((node) => node.type === WorkflowNodeType.Exposure);
    }

    private getExposureName(exposureNode: Plugin['props']['workflow']['props']['nodes'][number]): string {
        return typeof exposureNode?.data?.exposure?.name === 'string'
            ? exposureNode.data.exposure.name.trim()
            : '';
    }

    private requireAnalysisStorageClusterId(analysis: Analysis): string {
        const ownerClusterId = resolveAnalysisStorageClusterId(analysis.props);
        if (!ownerClusterId) {
            throw ApplicationError.notFound(
                ErrorCodes.TEAM_CLUSTER_NOT_FOUND,
                `Analysis ${analysis._id} is missing its canonical storage cluster`
            );
        }

        return ownerClusterId;
    }

    private async getPerAtomProperties(
        teamClusterId: string,
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep?: string,
        ownerClusterId?: string
    ): Promise<string[]> {
        const perAtomProperties = await this.daemonClient.command<string[]>(
            teamClusterId,
            'trajectory.plugin.property-names',
            {
                trajectoryId,
                analysisId,
                exposureId,
                ...(timestep ? { timestep: Number(timestep) } : {}),
                ownerClusterId
            }
        );

        return perAtomProperties || [];
    }
};
