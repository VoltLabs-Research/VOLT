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
import { normalizeAnalysisId, extractModifierAtomData } from '@modules/trajectory/utilities/trajectory/modifier-data';
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

            const modifierData = await this.atomProps.getModifierAnalysis(
                String(trajectoryId),
                String(resolvedAnalysisId),
                String(exposureId),
                String(timestep)
            );

            const atomsData = extractModifierAtomData(modifierData);
            const stats = this.atomProps.getMinMaxFromData(atomsData, property);
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
            const modifierData = await this.atomProps.getModifierAnalysis(
                String(trajectoryId),
                String(resolvedAnalysisId),
                String(exposureId),
                String(timestep)
            );

            const atomsData = extractModifierAtomData(modifierData);
            externalValues = this.atomProps.toFloat32ByAtomId(atomsData, String(property));
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
