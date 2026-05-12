import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import { TeamClusterSelectionService } from '@modules/container/infrastructure/services/TeamClusterSelectionService';
import { resolveTrajectoryStorageClusterId } from '@modules/cluster/application/utilities/cluster-location';
import { SceneArtifactSourceType } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import { IColorCodingService } from '@modules/trajectory/domain/port/color-coding/IColorCodingService';
import TrajectoryNativeDaemonService from '@modules/trajectory/infrastructure/services/native/TrajectoryNativeDaemonService';
import { recordSceneArtifact } from '@modules/trajectory/utilities/scene-artifacts/record-scene-artifact';
import { resolveSceneArtifactExecutionContext } from '@modules/trajectory/utilities/scene-artifacts/resolve-scene-artifact-execution-context';
import { resolveTrajectoryNativeClusterContext } from '@modules/trajectory/utilities/team-cluster/resolve-trajectory-native-cluster-context';
import { buildColorCodingObjectName } from '@modules/trajectory/utilities/trajectory/minio-path-builder';
import { normalizeAnalysisId } from '@modules/trajectory/utilities/trajectory/modifier-data';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Singleton } from '@shared/infrastructure/di/decorators';

import AnalysisRepository from '@modules/analysis/infrastructure/persistence/mongo/repositories/AnalysisRepository';
import SceneArtifactRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/scene-artifacts/SceneArtifactRepository';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import AtomPropertiesService from '@modules/trajectory/infrastructure/services/trajectory/AtomPropertiesService';
import TrajectoryDumpStorageService from '@modules/trajectory/infrastructure/services/trajectory/TrajectoryDumpStorageService';
import { Readable } from 'node:stream';

const buildClusterRequiredError = (): ApplicationError => {
    return new ApplicationError(
        ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND,
        'This operation requires a team cluster. No local native modules available.',
        501
    );
};

const buildPluginPropertyUnavailableError = (
    exposureId: string,
    property: string,
    timestep: string
): ApplicationError => {
    return ApplicationError.badRequest(
        ErrorCodes.PARTICLE_FILTER_PLUGIN_PROPERTY_UNAVAILABLE,
        `Plugin per-atom property "${property}" is not available for exposure "${exposureId}" at timestep ${timestep}`
    );
};

@Singleton()
export default class ColorCodingService implements IColorCodingService {
    constructor(
        
        private readonly atomProps: AtomPropertiesService,

        
        private readonly dumpStorage: TrajectoryDumpStorageService,

        
        private readonly sceneArtifactRepository: SceneArtifactRepository,

        
        private readonly trajectoryRepository: TrajectoryRepository,

        
        private readonly analysisRepository: AnalysisRepository,

        
        private readonly teamClusterSelectionService: TeamClusterSelectionService,

        
        private readonly trajectoryNativeDaemonService: TrajectoryNativeDaemonService
    ) { }

    async getProperties(
        trajectoryId: string,
        timestep: string | number,
        analysisId?: string
    ): Promise<{
        base: string[];
        modifiers: Record<string, string[]>;
        modifierTypes: Record<string, Record<string, 'number' | 'string'>>;
    }> {
        const resolvedAnalysisId = normalizeAnalysisId(analysisId);
        const clusterContext = await resolveTrajectoryNativeClusterContext({
            trajectoryId: String(trajectoryId),
            trajectoryRepository: this.trajectoryRepository,
            teamClusterSelectionService: this.teamClusterSelectionService
        });

        if (!clusterContext) {
            throw buildClusterRequiredError();
        }

        const metadata = await this.trajectoryNativeDaemonService.getTrajectoryMetadata({
            teamClusterId: clusterContext.computeClusterId,
            trajectoryId: String(trajectoryId),
            timestep: Number(timestep),
            objectKey: this.dumpStorage.getObjectName(String(trajectoryId), String(timestep)),
            ownerClusterId: clusterContext.storageClusterId
        });
        const headers = metadata.headers || [];

        const modifierProps: Record<string, string[]> = {};
        const modifierTypes: Record<string, Record<string, 'number' | 'string'>> = {};
        if (resolvedAnalysisId) {
            const configs = await this.atomProps.getAnalysisExposureAtomConfigs(
                String(resolvedAnalysisId),
                String(timestep)
            );
            for (const config of configs) {
                if (config.perAtomProperties.length === 0) continue;
                modifierProps[config.exposureId] = config.perAtomProperties;
                modifierTypes[config.exposureId] = config.perAtomPropertyTypes;
            }
        }

        return {
            base: headers,
            modifiers: modifierProps,
            modifierTypes
        };
    }

    async getStats(
        trajectoryId: string,
        timestep: string | number,
        property: string,
        type: string,
        analysisId?: string,
        exposureId?: string
    ): Promise<{ min: number; max: number }> {
        const resolvedAnalysisId = normalizeAnalysisId(analysisId);
        let min = Infinity;
        let max = -Infinity;

        if (type === 'modifier') {
            if (!exposureId || !resolvedAnalysisId) {
                throw ApplicationError.badRequest(
                    ErrorCodes.COLOR_CODING_MISSING_PARAMS,
                    'Missing required color-coding parameters'
                );
            }

            await this.resolveRemoteModifierSource(
                String(resolvedAnalysisId),
                String(exposureId),
                String(timestep),
                property
            );
            const stats = await this.atomProps.getModifierStats(
                String(trajectoryId),
                String(resolvedAnalysisId),
                String(exposureId),
                String(timestep),
                property
            );
            if (stats) {
                min = stats.min;
                max = stats.max;
            }
        } else {
            const clusterContext = await resolveTrajectoryNativeClusterContext({
                trajectoryId: String(trajectoryId),
                trajectoryRepository: this.trajectoryRepository,
                teamClusterSelectionService: this.teamClusterSelectionService
            });

            if (!clusterContext) {
                throw buildClusterRequiredError();
            }

            const metadata = await this.trajectoryNativeDaemonService.getTrajectoryMetadata({
                teamClusterId: clusterContext.computeClusterId,
                trajectoryId: String(trajectoryId),
                timestep: Number(timestep),
                objectKey: this.dumpStorage.getObjectName(String(trajectoryId), String(timestep)),
                ownerClusterId: clusterContext.storageClusterId
            });
            const headers = metadata.headers || [];
            const propIdx = headers.indexOf(property.toLowerCase());

            if (propIdx !== -1) {
                const stats = await this.trajectoryNativeDaemonService.getPropertyStats({
                    teamClusterId: clusterContext.computeClusterId,
                    trajectoryId: String(trajectoryId),
                    timestep: Number(timestep),
                    objectKey: this.dumpStorage.getObjectName(String(trajectoryId), String(timestep)),
                    ownerClusterId: clusterContext.storageClusterId,
                    property
                });
                if (stats) {
                    return { min: stats.min, max: stats.max };
                }
            }
        }

        if (min === Infinity) min = 0;
        if (max === -Infinity) max = 0;

        return { min, max };
    }

    async createColoredModel(
        trajectoryId: string,
        timestep: string | number,
        property: string,
        startValue: number,
        endValue: number,
        gradient: string,
        analysisId?: string,
        exposureId?: string
    ): Promise<string> {
        const resolvedAnalysisId = normalizeAnalysisId(analysisId);
        const objectName = buildColorCodingObjectName(
            trajectoryId,
            resolvedAnalysisId,
            timestep,
            exposureId,
            property,
            startValue,
            endValue,
            gradient
        );
        const {
            computeClusterId,
            storageClusterId
        } = await resolveSceneArtifactExecutionContext({
            trajectoryId: String(trajectoryId),
            timestep: String(timestep),
            analysisId: resolvedAnalysisId,
            analysisRepository: this.analysisRepository,
            trajectoryRepository: this.trajectoryRepository,
            teamClusterSelectionService: this.teamClusterSelectionService,
            dumpStorage: this.dumpStorage,
            buildClusterRequiredError
        });

        const modifierSource = exposureId && resolvedAnalysisId
            ? await this.resolveRemoteModifierSource(
                String(resolvedAnalysisId),
                String(exposureId),
                String(timestep),
                String(property)
            )
            : undefined;

        await this.trajectoryNativeDaemonService.exportColoredModel({
            teamClusterId: computeClusterId,
            trajectoryId: String(trajectoryId),
            timestep: Number(timestep),
            property: String(property),
            startValue: Number(startValue),
            endValue: Number(endValue),
            gradient: String(gradient),
            objectKey: objectName,
            ownerClusterId: storageClusterId,
            ...(modifierSource ?? {})
        });

        await recordSceneArtifact(this.sceneArtifactRepository, {
            trajectory: String(trajectoryId),
            storageClusterId,
            analysis: resolvedAnalysisId,
            sourceType: SceneArtifactSourceType.ColorCoding,
            timestep: Number(timestep),
            objectName,
            params: {
                property: String(property),
                startValue: Number(startValue),
                endValue: Number(endValue),
                gradient: String(gradient),
                exposureId
            },
            displayName: `CC · ${property} · [${startValue}, ${endValue}] · ${gradient} · t=${timestep}`,
            metadata: {
                analysisId: resolvedAnalysisId || null,
                exposureId: exposureId || null
            }
        });

        return objectName;
    }

    private async resolveRemoteModifierSource(
        analysisId: string,
        exposureId: string,
        timestep: string,
        property: string
    ): Promise<{ analysisId: string; exposureId: string; }> {
        const exposureConfigs = await this.atomProps.getAnalysisExposureAtomConfigs(analysisId, timestep);
        const exposureConfig = exposureConfigs.find((config) => config.exposureId === exposureId);

        if (!exposureConfig || !exposureConfig.perAtomProperties.includes(property)) {
            throw buildPluginPropertyUnavailableError(exposureId, property, timestep);
        }

        return {
            analysisId,
            exposureId
        };
    }

    async getModelStream(
        trajectoryId: string,
        timestep: string | number,
        property: string,
        startValue: number,
        endValue: number,
        gradient: string,
        analysisId?: string,
        exposureId?: string
    ): Promise<Readable> {
        const trajectory = await this.trajectoryRepository.findById(String(trajectoryId));
        const storageClusterId = trajectory
            ? resolveTrajectoryStorageClusterId(trajectory.props)
            : undefined;
        const objectName = buildColorCodingObjectName(
            trajectoryId,
            normalizeAnalysisId(analysisId),
            timestep,
            exposureId,
            property,
            startValue,
            endValue,
            gradient
        );

        if (storageClusterId) {
            return this.trajectoryNativeDaemonService.getObjectStream(
                storageClusterId,
                TEAM_CLUSTER_BUCKETS.MODELS,
                objectName
            );
        }

        throw buildClusterRequiredError();
    }
};
