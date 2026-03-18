import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { SceneArtifactSourceType } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { IAtomPropertiesService } from '@modules/trajectory/domain/port/trajectory/IAtomPropertiesService';
import { IColorCodingService } from '@modules/trajectory/domain/port/color-coding/IColorCodingService';
import { ISceneArtifactRepository } from '@modules/trajectory/domain/port/scene-artifacts/ISceneArtifactRepository';
import { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/trajectory/ITrajectoryDumpStorageService';
import { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { buildColorCodingObjectName } from '@modules/trajectory/utilities/trajectory/minio-path-builder';
import { normalizeAnalysisId } from '@modules/trajectory/utilities/trajectory/modifier-data';
import { recordSceneArtifact } from '@modules/trajectory/utilities/scene-artifacts/record-scene-artifact';
import { resolveSceneArtifactTeamCluster } from '@modules/trajectory/utilities/scene-artifacts/resolve-scene-artifact-team-cluster';
import { IStorageService } from '@shared/domain/port/IStorageService';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TrajectoryNativeDaemonService from '@modules/trajectory/infrastructure/services/native/TrajectoryNativeDaemonService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import { Readable } from 'node:stream';
import { injectable, inject } from 'tsyringe';

const buildDumpNotFoundError = (): ApplicationError => {
    return ApplicationError.notFound(
        ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND,
        'Trajectory dump not found'
    );
};

const buildClusterRequiredError = (): ApplicationError => {
    return new ApplicationError(
        ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND,
        'This operation requires a team cluster. No local native modules available.',
        501
    );
};

const buildPluginPropertyUnmappableError = (property: string): ApplicationError => {
    return ApplicationError.badRequest(
        ErrorCodes.PARTICLE_FILTER_PLUGIN_PROPERTY_UNMAPPABLE,
        `Plugin per-atom property "${property}" cannot be mapped to trajectory atom ids`
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

@injectable()
export default class ColorCodingService implements IColorCodingService {
    constructor(
        @inject(TRAJECTORY_TOKENS.AtomPropertiesService)
        private readonly atomProps: IAtomPropertiesService,

        @inject(TRAJECTORY_TOKENS.TrajectoryDumpStorageService)
        private readonly dumpStorage: ITrajectoryDumpStorageService,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        @inject(TRAJECTORY_TOKENS.SceneArtifactRepository)
        private readonly sceneArtifactRepository: ISceneArtifactRepository,

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository,

        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository,

        @inject(TRAJECTORY_TOKENS.TrajectoryNativeDaemonService)
        private readonly trajectoryNativeDaemonService: TrajectoryNativeDaemonService
    ) { }

    async getProperties(
        trajectoryId: string,
        timestep: string | number,
        analysisId?: string
    ): Promise<{ base: string[]; modifiers: Record<string, string[]> }> {
        const resolvedAnalysisId = normalizeAnalysisId(analysisId);
        const trajectory = await this.trajectoryRepository.findById(String(trajectoryId));

        if (!trajectory?.props.teamCluster) {
            throw buildClusterRequiredError();
        }

        const metadata = await this.trajectoryNativeDaemonService.getTrajectoryMetadata({
            teamClusterId: trajectory.props.teamCluster,
            trajectoryId: String(trajectoryId),
            timestep: Number(timestep),
            objectKey: this.dumpStorage.getObjectName(String(trajectoryId), String(timestep))
        });
        const headers = metadata.headers || [];

        const modifierProps = resolvedAnalysisId
            ? await this.atomProps.getModifierPerAtomProps(String(resolvedAnalysisId))
            : {};

        return {
            base: headers,
            modifiers: modifierProps
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

            const externalValues = await this.resolveRemoteExternalValues(
                String(trajectoryId),
                String(resolvedAnalysisId),
                String(exposureId),
                String(timestep),
                property
            );
            const stats = this.getExternalValueStats(externalValues);
            if (stats) {
                min = stats.min;
                max = stats.max;
            }
        } else {
            const trajectory = await this.trajectoryRepository.findById(String(trajectoryId));

            if (!trajectory?.props.teamCluster) {
                throw buildClusterRequiredError();
            }

            const metadata = await this.trajectoryNativeDaemonService.getTrajectoryMetadata({
                teamClusterId: trajectory.props.teamCluster,
                trajectoryId: String(trajectoryId),
                timestep: Number(timestep),
                objectKey: this.dumpStorage.getObjectName(String(trajectoryId), String(timestep))
            });
            const headers = metadata.headers || [];
            const propIdx = headers.indexOf(property.toLowerCase());

            if (propIdx !== -1) {
                const stats = await this.trajectoryNativeDaemonService.getPropertyStats({
                    teamClusterId: trajectory.props.teamCluster,
                    trajectoryId: String(trajectoryId),
                    timestep: Number(timestep),
                    objectKey: this.dumpStorage.getObjectName(String(trajectoryId), String(timestep)),
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
        const teamClusterId = await resolveSceneArtifactTeamCluster({
            trajectoryId: String(trajectoryId),
            analysisId: resolvedAnalysisId,
            analysisRepository: this.analysisRepository,
            trajectoryRepository: this.trajectoryRepository
        });

        if (!teamClusterId) {
            throw buildClusterRequiredError();
        }

        const dumpExists = await this.dumpStorage.existsDump(
            String(trajectoryId),
            String(timestep)
        );

        if (!dumpExists) {
            throw ApplicationError.notFound(
                ErrorCodes.TRAJECTORY_DUMP_NOT_FOUND,
                `Trajectory dump for timestep ${timestep} not found`
            );
        }

        let externalValues: Float32Array | undefined;

        if (exposureId && resolvedAnalysisId) {
            externalValues = await this.resolveRemoteExternalValues(
                String(trajectoryId),
                String(resolvedAnalysisId),
                String(exposureId),
                String(timestep),
                String(property)
            );
        }

        await this.trajectoryNativeDaemonService.exportColoredModel({
            teamClusterId,
            trajectoryId: String(trajectoryId),
            timestep: Number(timestep),
            property: String(property),
            startValue: Number(startValue),
            endValue: Number(endValue),
            gradient: String(gradient),
            objectKey: objectName,
            externalValues
        });

        await recordSceneArtifact(this.sceneArtifactRepository, {
            trajectory: String(trajectoryId),
            teamCluster: teamClusterId,
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

    private getExternalValueStats(
        externalValues?: Float32Array
    ): { min: number; max: number; } | undefined {
        if (!externalValues || externalValues.length === 0) {
            return undefined;
        }

        let min = Infinity;
        let max = -Infinity;

        for (const value of externalValues) {
            if (Number.isNaN(value)) {
                continue;
            }

            min = Math.min(min, value);
            max = Math.max(max, value);
        }

        if (min === Infinity || max === -Infinity) {
            return undefined;
        }

        return { min, max };
    }

    private async resolveRemoteExternalValues(
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep: string,
        property: string
    ): Promise<Float32Array | undefined> {
        const exposureConfigs = await this.atomProps.getAnalysisExposureAtomConfigs(analysisId, timestep);
        const exposureConfig = exposureConfigs.find((config) => config.exposureId === exposureId);

        if (!exposureConfig || !exposureConfig.perAtomProperties.includes(property)) {
            throw buildPluginPropertyUnavailableError(exposureId, property, timestep);
        }

        const trajectory = await this.trajectoryRepository.findById(String(trajectoryId));
        const teamClusterId = trajectory?.props.teamCluster;

        if (!teamClusterId) {
            return undefined;
        }

        const dumpAtomIds = await this.trajectoryNativeDaemonService.getAtomIds({
            teamClusterId,
            trajectoryId: String(trajectoryId),
            timestep: Number(timestep),
            objectKey: this.dumpStorage.getObjectName(String(trajectoryId), String(timestep))
        });

        if (dumpAtomIds.length === 0) {
            return new Float32Array();
        }

        const pluginIndex = await this.atomProps.buildPluginIndexForAtomIds(
            String(trajectoryId),
            String(analysisId),
            String(exposureId),
            String(timestep),
            new Set(dumpAtomIds)
        );

        if (!pluginIndex) {
            throw buildPluginPropertyUnmappableError(property);
        }

        const maxAtomId = dumpAtomIds.reduce((maxId, atomId) => Math.max(maxId, atomId), 0);
        const externalValues = new Float32Array(maxAtomId + 1);
        externalValues.fill(Number.NaN);

        for (const atomId of dumpAtomIds) {
            const row = pluginIndex.get(atomId);
            if (!row) {
                continue;
            }

            const rawValue = row[property];
            const numericValue = Number(rawValue);
            if (Number.isFinite(numericValue)) {
                externalValues[atomId] = numericValue;
            }
        }

        return externalValues;
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

        if (trajectory?.props.teamCluster) {
            return this.trajectoryNativeDaemonService.getObjectStream(
                trajectory.props.teamCluster,
                SYS_BUCKETS.MODELS,
                objectName
            );
        }

        if (!await this.storageService.exists(SYS_BUCKETS.MODELS, objectName)) {
            throw buildDumpNotFoundError();
        }

        return this.storageService.getStream(SYS_BUCKETS.MODELS, objectName);
    }
};
