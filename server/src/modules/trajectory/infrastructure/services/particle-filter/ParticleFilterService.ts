import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { SceneArtifactSourceType } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { IAtomPropertiesService } from '@modules/trajectory/domain/port/trajectory/IAtomPropertiesService';
import { IParticleFilterService, ParticleFilterCombinator, ParticleFilterCondition, ParticleFilterGroup } from '@modules/trajectory/domain/port/particle-filter/IParticleFilterService';
import { ISceneArtifactRepository } from '@modules/trajectory/domain/port/scene-artifacts/ISceneArtifactRepository';
import { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/trajectory/ITrajectoryDumpStorageService';
import { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { buildParticleFilterObjectName } from '@modules/trajectory/utilities/trajectory/minio-path-builder';
import { normalizeAnalysisId } from '@modules/trajectory/utilities/trajectory/modifier-data';
import { recordSceneArtifact } from '@modules/trajectory/utilities/scene-artifacts/record-scene-artifact';
import { resolveSceneArtifactTeamCluster } from '@modules/trajectory/utilities/scene-artifacts/resolve-scene-artifact-team-cluster';
import { IStorageService } from '@shared/domain/port/IStorageService';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TrajectoryNativeDaemonService from '@modules/trajectory/infrastructure/services/native/TrajectoryNativeDaemonService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import { createHash } from 'node:crypto';
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
    ): Promise<{ dump: string[]; perAtom: Record<string, string[]>; exposureNames: Record<string, string> }> {
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

        const modifierProps: Record<string, string[]> = {};
        const exposureNames: Record<string, string> = {};

        if (resolvedAnalysisId) {
            const configs = await this.atomProps.getAnalysisExposureAtomConfigs(
                String(resolvedAnalysisId),
                String(timestep)
            );

            for (const config of configs) {
                if (config.perAtomProperties.length === 0) {
                    continue;
                }

                modifierProps[config.exposureId] = config.perAtomProperties;
                exposureNames[config.exposureId] = config.exposureName;
            }
        }

        return {
            dump: dumpHeaders,
            perAtom: modifierProps,
            exposureNames
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
            return this.atomProps.getModifierUniqueValues(
                String(trajectoryId),
                String(resolvedAnalysisId),
                String(exposureId),
                String(timestep),
                property,
                maxValues
            );
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
        filterGroup: ParticleFilterGroup,
        analysisId?: string
    ): Promise<{ matchCount: number; totalAtoms: number }> {
        const resolvedAnalysisId = normalizeAnalysisId(analysisId);
        const trajectory = await this.trajectoryRepository.findById(String(trajectoryId));

        if (!trajectory?.props.teamCluster) {
            throw buildClusterRequiredError();
        }

        const result = await this.getCombinedFilterResult(
            trajectory.props.teamCluster,
            String(trajectoryId),
            resolvedAnalysisId || null,
            String(timestep),
            filterGroup
        );

        return {
            matchCount: result.matchCount,
            totalAtoms: result.totalAtoms
        };
    }

    async applyAction(
        trajectoryId: string,
        timestep: string | number,
        action: 'delete' | 'highlight',
        filterGroup: ParticleFilterGroup,
        analysisId?: string
    ): Promise<{ fileId: string; atomsResult: number; action: string }> {
        const resolvedAnalysisId = normalizeAnalysisId(analysisId);
        const objectName = this.buildObjectName(trajectoryId, resolvedAnalysisId, timestep, filterGroup, action);
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

        const filterResult = await this.getCombinedFilterResult(
            teamClusterId,
            String(trajectoryId),
            resolvedAnalysisId || null,
            String(timestep),
            filterGroup
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

        const firstCondition = filterGroup.conditions[0];
        const artifactParams: Record<string, unknown> = {
            combinator: filterGroup.combinator,
            conditions: filterGroup.conditions,
            action
        };

        if (filterGroup.conditions.length === 1 && firstCondition) {
            artifactParams.property = String(firstCondition.property);
            artifactParams.operator = String(firstCondition.operator);
            artifactParams.value = Number(firstCondition.value);
            artifactParams.exposureId = firstCondition.exposureId;
        }

        await recordSceneArtifact(this.sceneArtifactRepository, {
            trajectory: String(trajectoryId),
            teamCluster: teamClusterId,
            analysis: resolvedAnalysisId,
            sourceType: SceneArtifactSourceType.ParticleFilter,
            timestep: Number(timestep),
            objectName,
            params: artifactParams,
            displayName: this.buildDisplayName(filterGroup, action, timestep),
            metadata: {
                analysisId: resolvedAnalysisId || null,
                exposureId: firstCondition?.exposureId || null,
                atomsResult,
                totalAtoms: filterResult.totalAtoms
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
        filterGroup: ParticleFilterGroup,
        action?: string,
        analysisId?: string
    ): Promise<Readable> {
        const trajectory = await this.trajectoryRepository.findById(String(trajectoryId));
        const actionPart = action || 'delete';
        const objectName = this.buildObjectName(
            trajectoryId,
            normalizeAnalysisId(analysisId),
            timestep,
            filterGroup,
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
        timestep: string,
        condition: ParticleFilterCondition
    ): Promise<{ mask: Uint8Array; matchCount: number; totalAtoms: number; }> {
        const modifierSource = await this.resolveRemoteModifierSource(
            analysisId,
            condition.exposureId,
            timestep,
            condition.property
        );

        return this.trajectoryNativeDaemonService.previewFilter({
            teamClusterId,
            trajectoryId,
            timestep: Number(timestep),
            objectKey: this.dumpStorage.getObjectName(trajectoryId, timestep),
            property: condition.property,
            operator: condition.operator,
            value: condition.value,
            ...(modifierSource ?? {})
        });
    }

    private async getCombinedFilterResult(
        teamClusterId: string,
        trajectoryId: string,
        analysisId: string | null,
        timestep: string,
        filterGroup: ParticleFilterGroup
    ): Promise<{ mask: Uint8Array; matchCount: number; totalAtoms: number; }> {
        const results = await Promise.all(filterGroup.conditions.map((condition) => {
            return this.getRemoteFilterResult(teamClusterId, trajectoryId, analysisId, timestep, condition);
        }));

        const firstResult = results[0];
        let combinedMask: Uint8Array = new Uint8Array(Array.from(firstResult.mask));

        for (let index = 1; index < results.length; index += 1) {
            combinedMask = this.combineMasks(combinedMask, results[index].mask, filterGroup.combinator);
        }

        return {
            mask: combinedMask,
            matchCount: this.countMatches(combinedMask),
            totalAtoms: firstResult.totalAtoms
        };
    }

    private combineMasks(
        leftMask: Uint8Array,
        rightMask: Uint8Array,
        combinator: ParticleFilterCombinator
    ): Uint8Array {
        const combinedMask: Uint8Array = new Uint8Array(leftMask.length);

        for (let index = 0; index < leftMask.length; index += 1) {
            if (combinator === ParticleFilterCombinator.Or) {
                combinedMask[index] = leftMask[index] || rightMask[index] ? 1 : 0;
                continue;
            }

            combinedMask[index] = leftMask[index] && rightMask[index] ? 1 : 0;
        }

        return combinedMask;
    }

    private countMatches(mask: Uint8Array): number {
        return mask.reduce((total, value) => total + (value ? 1 : 0), 0);
    }

    private buildObjectName(
        trajectoryId: string,
        analysisId: string | undefined,
        timestep: string | number,
        filterGroup: ParticleFilterGroup,
        action: string
    ): string {
        if (filterGroup.conditions.length === 1) {
            const condition = filterGroup.conditions[0];

            return buildParticleFilterObjectName(
                trajectoryId,
                analysisId,
                timestep,
                condition.exposureId,
                condition.property,
                condition.operator,
                condition.value,
                action
            );
        }

        const filterHash = createHash('sha1').update(JSON.stringify(filterGroup)).digest('hex').slice(0, 12);
        const segment = analysisId || 'default';

        return `trajectory-${trajectoryId}/analysis-${segment}/glb/${timestep}/particle-filter/composite/${filterGroup.combinator.toLowerCase()}-${filterHash}-${action}.glb`;
    }

    private buildDisplayName(filterGroup: ParticleFilterGroup, action: string, timestep: string | number): string {
        const conditionsLabel = filterGroup.conditions.map((condition) => {
            const sourcePrefix = condition.exposureId ? `${condition.exposureId}:` : '';
            return `${sourcePrefix}${condition.property} ${condition.operator} ${condition.value}`;
        }).join(` ${filterGroup.combinator} `);

        return `PF · ${conditionsLabel} · ${action} · t=${timestep}`;
    }

    private async resolveRemoteModifierSource(
        analysisId: string | null,
        exposureId: string | undefined,
        timestep: string,
        property: string
    ): Promise<{ analysisId: string; exposureId: string; } | undefined> {
        if (!analysisId || !exposureId) {
            return undefined;
        }

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
};
