import { ErrorCodes } from '@core/constants/error-codes';
import type { Analysis, PluginLike, WorkflowNodeLike } from '@shared/contracts/types';
import { WorkflowNodeType } from '@shared/contracts/types/Plugin';
import {
    resolveAnalysisComputeClusterId,
    resolveAnalysisStorageClusterId
} from '@shared/application/utilities/cluster-location';
import type { IAnalysisRepository, IPluginRepository } from '@shared/contracts/ports';
import { COMPUTE_TOKENS } from '@shared/contracts/tokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { container as diContainer } from 'tsyringe';

export interface FilterExpression {
    property: string;
    operator: '==' | '!=' | '>' | '>=' | '<' | '<=';
    value: number | string;
}

export type PerAtomPropertyType = 'number' | 'string';

export interface ExposureAtomConfig {
    exposureId: string;
    exposureName: string;
    iterableKey?: string;
    perAtomProperties: string[];
    perAtomPropertyTypes: Record<string, PerAtomPropertyType>;
    schemaKeysMap: Map<string, string[]>;
}

export interface AnalysisAllAtomsResult {
    propertyNames: string[];
    atoms: Record<string, unknown>[];
}

export class AtomPropertiesService {
    #daemonClientCache?: TeamClusterDaemonClient;
    private get daemonClient(): TeamClusterDaemonClient {
        return (this.#daemonClientCache ??= diContainer.resolve(TeamClusterDaemonClient));
    }

    #analysisRepositoryCache?: IAnalysisRepository;
    private get analysisRepository(): IAnalysisRepository {
        return (this.#analysisRepositoryCache ??= diContainer.resolve<IAnalysisRepository>(COMPUTE_TOKENS.AnalysisRepository));
    }

    #pluginRepositoryCache?: IPluginRepository<PluginLike>;
    private get pluginRepository(): IPluginRepository<PluginLike> {
        return (this.#pluginRepositoryCache ??= diContainer.resolve<IPluginRepository<PluginLike>>(COMPUTE_TOKENS.PluginRepository));
    }

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

        const lineExposureIds = this.getLineExposureIds(plugin);
        const exposureNodes = this.getExposureNodes(plugin)
            .filter((node) => !lineExposureIds.has(String(node.id)));
        const configs: ExposureAtomConfig[] = [];

        for (const exposureNode of exposureNodes) {
            const exposureId = String(exposureNode.id);
            const perAtomPropertySchemas = await this.getPerAtomPropertySchemas(
                teamClusterId,
                trajectoryId,
                analysisId,
                exposureId,
                timestep,
                ownerClusterId
            );
            const perAtomProperties = perAtomPropertySchemas.map((schema) => schema.name);

            configs.push({
                exposureId,
                exposureName: this.getExposureName(exposureNode),
                perAtomProperties,
                perAtomPropertyTypes: Object.fromEntries(perAtomPropertySchemas.map((schema) => [schema.name, schema.type])),
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

        const perAtomPropertySchemas = await this.getPerAtomPropertySchemas(
            teamClusterId,
            trajectoryId,
            analysisId,
            String(exposureId),
            undefined,
            ownerClusterId
        );
        const perAtomProperties = perAtomPropertySchemas.map((schema) => schema.name);

        return {
            exposureId: String(exposureId),
            exposureName: this.getExposureName(exposureNode),
            perAtomProperties,
            perAtomPropertyTypes: Object.fromEntries(perAtomPropertySchemas.map((schema) => [schema.name, schema.type])),
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
            ChannelCommands.TrajectoryPluginAnalysisAllAtoms,
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
            ChannelCommands.TrajectoryPluginAtomIndex,
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
            ChannelCommands.TrajectoryPluginModifierValues,
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
            ChannelCommands.TrajectoryPluginModifierStats,
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
    ): Promise<Array<number | string>> {
        const { analysis } = await this.getAnalysisAndPlugin(analysisId);
        const teamClusterId = resolveAnalysisComputeClusterId(analysis.props);
        const ownerClusterId = this.requireAnalysisStorageClusterId(analysis);

        if (!teamClusterId) return [];

        const result = await this.daemonClient.command<Array<number | string> | null>(
            teamClusterId,
            ChannelCommands.TrajectoryPluginModifierUniqueValues,
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

    private async getAnalysisAndPlugin(analysisId: string): Promise<{ analysis: Analysis; plugin: PluginLike }> {
        const analysis = await this.analysisRepository.findById(analysisId);
        if (!analysis) throw new ApplicationError(ErrorCodes.ANALYSIS_NOT_FOUND, ErrorCodes.ANALYSIS_NOT_FOUND, 404);

        const plugin = await this.pluginRepository.findById(analysis.props.plugin);
        if (!plugin) throw new ApplicationError(ErrorCodes.PLUGIN_NOT_FOUND, ErrorCodes.PLUGIN_NOT_FOUND, 404);

        return { analysis, plugin };
    }

    private getExposureNodes(plugin: PluginLike) {
        return plugin.props.workflow.props.nodes
            .filter((node) => node.type === WorkflowNodeType.Exposure)
            .filter((node) => !this.isSharedOnlyExposureNode(node));
    }

    private isSharedOnlyExposureNode(node: WorkflowNodeLike): boolean {
        const results = node?.data?.exposure?.results;
        return typeof results === 'string' && results.endsWith('neighbor_lattice.parquet');
    }

    private getLineExposureIds(plugin: PluginLike): Set<string> {
        const exposures = Array.isArray(plugin.props.exposures) ? plugin.props.exposures : [];
        const ids = new Set<string>();
        for (const exposure of exposures) {
            const candidate = exposure as { _id?: unknown; export?: { exporter?: string } | null };
            if (candidate?.export?.exporter === 'LineExporter' && candidate._id !== undefined) {
                ids.add(String(candidate._id));
            }
        }
        return ids;
    }

    private getExposureName(exposureNode: WorkflowNodeLike): string {
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
            ChannelCommands.TrajectoryPluginPropertyNames,
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

    private async getPerAtomPropertySchemas(
        teamClusterId: string,
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep?: string,
        ownerClusterId?: string
    ): Promise<Array<{ name: string; type: PerAtomPropertyType }>> {
        try {
            const schemas = await this.daemonClient.command<Array<{ name: string; type: PerAtomPropertyType }> | null>(
                teamClusterId,
                ChannelCommands.TrajectoryPluginPropertySchema,
                {
                    trajectoryId,
                    analysisId,
                    exposureId,
                    ...(timestep ? { timestep: Number(timestep) } : {}),
                    ownerClusterId
                }
            );

            if (Array.isArray(schemas) && schemas.length > 0) {
                return schemas
                    .filter((schema) => typeof schema.name === 'string' && schema.name.length > 0)
                    .map((schema) => ({
                        name: schema.name,
                        type: schema.type === 'string' ? 'string' : 'number'
                    }));
            }
        } catch {
        }

        const propertyNames = await this.getPerAtomProperties(
            teamClusterId,
            trajectoryId,
            analysisId,
            exposureId,
            timestep,
            ownerClusterId
        );

        return propertyNames.map((name) => ({ name, type: 'number' }));
    }
}

export default new AtomPropertiesService();
