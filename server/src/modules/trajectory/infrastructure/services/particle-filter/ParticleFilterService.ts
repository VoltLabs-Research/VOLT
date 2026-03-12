import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { SceneArtifactSourceType } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { IAtomPropertiesService, FilterExpression } from '@modules/trajectory/domain/port/trajectory/IAtomPropertiesService';
import { IParticleFilterService } from '@modules/trajectory/domain/port/particle-filter/IParticleFilterService';
import { ISceneArtifactRepository } from '@modules/trajectory/domain/port/scene-artifacts/ISceneArtifactRepository';
import { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/trajectory/ITrajectoryDumpStorageService';
import { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { buildParticleFilterObjectName } from '@modules/trajectory/utilities/trajectory/minio-path-builder';
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
export default class ParticleFilterService implements IParticleFilterService {
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
    ): Promise<{ dump: string[]; perAtom: Record<string, string[]> }> {
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
        const dumpHeaders = metadata.headers || [];

        const modifierProps = resolvedAnalysisId
            ? await this.atomProps.getModifierPerAtomProps(String(resolvedAnalysisId))
            : {};

        return {
            dump: dumpHeaders,
            perAtom: modifierProps
        };
    }

    async getUniqueValues(
        trajectoryId: string,
        timestep: string | number,
        property: string,
        maxValues: number = 100,
        analysisId?: string,
        exposureId?: string
    ): Promise<number[]> {
        const resolvedAnalysisId = normalizeAnalysisId(analysisId);
        const trajectory = await this.trajectoryRepository.findById(String(trajectoryId));

        if (exposureId && resolvedAnalysisId) {
            const modifierData = await this.atomProps.getModifierAnalysis(
                String(trajectoryId),
                String(resolvedAnalysisId),
                String(exposureId),
                String(timestep)
            );
            const atomsData = extractModifierAtomData(modifierData);
            if (!atomsData) return [];

            const uniqueSet = new Set<number>();
            for (const atom of atomsData) {
                if (atom[property] !== undefined && uniqueSet.size < maxValues) {
                    uniqueSet.add(Number(atom[property]));
                }
            }
            return Array.from(uniqueSet).sort((a, b) => a - b);
        }

        if (!trajectory?.props.teamCluster) {
            throw buildClusterRequiredError();
        }

        return this.trajectoryNativeDaemonService.getUniqueValues({
            teamClusterId: trajectory.props.teamCluster,
            trajectoryId: String(trajectoryId),
            timestep: Number(timestep),
            objectKey: this.dumpStorage.getObjectName(String(trajectoryId), String(timestep)),
            property,
            maxValues
        });
    }

    async preview(
        trajectoryId: string,
        timestep: string | number,
        expression: FilterExpression,
        analysisId?: string,
        exposureId?: string
    ): Promise<{ matchCount: number; totalAtoms: number }> {
        const resolvedAnalysisId = normalizeAnalysisId(analysisId);
        const trajectory = await this.trajectoryRepository.findById(String(trajectoryId));

        if (!trajectory?.props.teamCluster) {
            throw buildClusterRequiredError();
        }

        const externalValues = await this.resolveRemoteExternalValues(
            String(trajectoryId),
            resolvedAnalysisId || null,
            exposureId || undefined,
            String(timestep),
            expression.property
        );
        const result = await this.trajectoryNativeDaemonService.previewFilter({
            teamClusterId: trajectory.props.teamCluster,
            trajectoryId: String(trajectoryId),
            timestep: Number(timestep),
            objectKey: this.dumpStorage.getObjectName(String(trajectoryId), String(timestep)),
            property: expression.property,
            operator: expression.operator,
            value: expression.value,
            externalValues
        });

        return {
            matchCount: result.matchCount,
            totalAtoms: result.totalAtoms
        };
    }

    async applyAction(
        trajectoryId: string,
        timestep: string | number,
        action: 'delete' | 'highlight',
        expression: FilterExpression,
        analysisId?: string,
        exposureId?: string
    ): Promise<{ fileId: string; atomsResult: number; action: string }> {
        const resolvedAnalysisId = normalizeAnalysisId(analysisId);
        const objectName = buildParticleFilterObjectName(
            trajectoryId,
            resolvedAnalysisId,
            timestep,
            exposureId,
            expression.property,
            expression.operator,
            expression.value,
            action
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

        const filterResult = await this.getRemoteFilterResult(
            teamClusterId,
            String(trajectoryId),
            resolvedAnalysisId || null,
            exposureId || undefined,
            String(timestep),
            expression
        );

        const response = await this.trajectoryNativeDaemonService.exportParticleFilterModel({
            teamClusterId,
            trajectoryId: String(trajectoryId),
            timestep: Number(timestep),
            action,
            mask: filterResult.mask,
            objectKey: objectName
        });
        const atomsResult = response.atomsResult;

        await recordSceneArtifact(this.sceneArtifactRepository, {
            trajectory: String(trajectoryId),
            teamCluster: teamClusterId,
            analysis: resolvedAnalysisId,
            sourceType: SceneArtifactSourceType.ParticleFilter,
            timestep: Number(timestep),
            objectName,
            params: {
                property: String(expression.property),
                operator: String(expression.operator),
                value: Number(expression.value),
                action,
                exposureId
            },
            displayName: `PF · ${expression.property} ${expression.operator} ${expression.value} · ${action} · t=${timestep}`,
            metadata: {
                analysisId: resolvedAnalysisId || null,
                exposureId: exposureId || null,
                atomsResult,
                totalAtoms: filterResult.mask.length
            }
        });

        return {
            fileId: objectName,
            atomsResult,
            action
        };
    }

    async getModelStream(
        trajectoryId: string,
        timestep: string | number,
        property: string,
        operator: string,
        value: string | number,
        action?: string,
        analysisId?: string,
        exposureId?: string
    ): Promise<Readable> {
        const trajectory = await this.trajectoryRepository.findById(String(trajectoryId));
        const actionPart = action || 'delete';
        const objectName = buildParticleFilterObjectName(
            trajectoryId,
            normalizeAnalysisId(analysisId),
            timestep,
            exposureId,
            property,
            operator,
            value,
            actionPart
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

    private async getRemoteFilterResult(
        teamClusterId: string,
        trajectoryId: string,
        analysisId: string | null,
        exposureId: string | undefined,
        timestep: string,
        expression: FilterExpression
    ): Promise<{ mask: Uint8Array; matchCount: number; totalAtoms: number; }> {
        const externalValues = await this.resolveRemoteExternalValues(
            trajectoryId,
            analysisId,
            exposureId,
            timestep,
            expression.property
        );

        return this.trajectoryNativeDaemonService.previewFilter({
            teamClusterId,
            trajectoryId,
            timestep: Number(timestep),
            objectKey: this.dumpStorage.getObjectName(trajectoryId, timestep),
            property: expression.property,
            operator: expression.operator,
            value: expression.value,
            externalValues
        });
    }

    private async resolveRemoteExternalValues(
        trajectoryId: string,
        analysisId: string | null,
        exposureId: string | undefined,
        timestep: string,
        property: string
    ): Promise<Float32Array | undefined> {
        if (!analysisId || !exposureId) {
            return undefined;
        }

        try {
            const config = await this.atomProps.getExposureAtomConfig(analysisId, exposureId);
            if (!config.perAtomProperties.includes(property)) {
                return undefined;
            }
        } catch {
            return undefined;
        }

        const modifierData = await this.atomProps.getModifierAnalysis(
            trajectoryId,
            analysisId,
            exposureId,
            timestep
        );

        return this.atomProps.toFloat32ByAtomId(modifierData, property);
    }
};
