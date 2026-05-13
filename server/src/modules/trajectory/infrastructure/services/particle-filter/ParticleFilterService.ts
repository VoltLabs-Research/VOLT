import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import { TeamClusterSelectionService } from '@modules/container/infrastructure/services/TeamClusterSelectionService';
import { resolveTrajectoryStorageClusterId } from '@modules/cluster/application/utilities/cluster-location';
import { SceneArtifactSourceType } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import {
    IParticleFilterService,
    ParticleFilterCombinator,
    ParticleFilterCondition,
    ParticleFilterRequest
} from '@modules/trajectory/domain/port/particle-filter/IParticleFilterService';
import TrajectoryNativeDaemonService from '@modules/trajectory/infrastructure/services/native/TrajectoryNativeDaemonService';
import type { TrajectoryNativeObjectStreamResponse } from '@modules/trajectory/infrastructure/services/native/TrajectoryNativeDaemonService';
import { recordSceneArtifact } from '@modules/trajectory/utilities/scene-artifacts/record-scene-artifact';
import { resolveSceneArtifactExecutionContext } from '@modules/trajectory/utilities/scene-artifacts/resolve-scene-artifact-execution-context';
import { resolveTrajectoryNativeClusterContext } from '@modules/trajectory/utilities/team-cluster/resolve-trajectory-native-cluster-context';
import { buildParticleFilterObjectName } from '@modules/trajectory/utilities/trajectory/minio-path-builder';
import { normalizeAnalysisId } from '@modules/trajectory/utilities/trajectory/modifier-data';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Singleton } from '@shared/infrastructure/di/decorators';

import AnalysisRepository from '@modules/analysis/infrastructure/persistence/mongo/repositories/AnalysisRepository';
import SceneArtifactRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/scene-artifacts/SceneArtifactRepository';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import AtomPropertiesService from '@modules/trajectory/infrastructure/services/trajectory/AtomPropertiesService';
import TrajectoryDumpStorageService from '@modules/trajectory/infrastructure/services/trajectory/TrajectoryDumpStorageService';
import { createHash } from 'node:crypto';
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
export default class ParticleFilterService implements IParticleFilterService {
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
        dump: string[];
        perAtom: Record<string, string[]>;
        perAtomTypes: Record<string, Record<string, 'number' | 'string'>>;
        exposureNames: Record<string, string>;
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
        const dumpHeaders = metadata.headers || [];

        const modifierProps: Record<string, string[]> = {};
        const perAtomTypes: Record<string, Record<string, 'number' | 'string'>> = {};
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
                perAtomTypes[config.exposureId] = config.perAtomPropertyTypes;
                exposureNames[config.exposureId] = config.exposureName;
            }
        }

        return {
            dump: dumpHeaders,
            perAtom: modifierProps,
            perAtomTypes,
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
    ): Promise<Array<number | string>> {
        const resolvedAnalysisId = normalizeAnalysisId(analysisId);
        const clusterContext = await resolveTrajectoryNativeClusterContext({
            trajectoryId: String(trajectoryId),
            trajectoryRepository: this.trajectoryRepository,
            teamClusterSelectionService: this.teamClusterSelectionService
        });

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

        if (!clusterContext) {
            throw buildClusterRequiredError();
        }

        return this.trajectoryNativeDaemonService.getUniqueValues({
            teamClusterId: clusterContext.computeClusterId,
            trajectoryId: String(trajectoryId),
            timestep: Number(timestep),
            objectKey: this.dumpStorage.getObjectName(String(trajectoryId), String(timestep)),
            ownerClusterId: clusterContext.storageClusterId,
            property,
            maxValues
        });
    }

    async preview(
        trajectoryId: string,
        timestep: string | number,
        request: ParticleFilterRequest,
        analysisId?: string
    ): Promise<{ matchCount: number; totalAtoms: number }> {
        const resolvedAnalysisId = normalizeAnalysisId(analysisId);
        const trajectory = await this.trajectoryRepository.findById(String(trajectoryId));
        const storageClusterId = trajectory
            ? resolveTrajectoryStorageClusterId(trajectory.props)
            : undefined;

        if (!trajectory || !storageClusterId) {
            throw buildClusterRequiredError();
        }

        const computeClusterId = await this.teamClusterSelectionService.resolveComputeClusterId(
            trajectory.props.team,
            undefined,
            storageClusterId
        );

        const result = await this.getCombinedFilterResult(
            computeClusterId,
            storageClusterId,
            String(trajectoryId),
            resolvedAnalysisId || null,
            String(timestep),
            request
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
        request: ParticleFilterRequest,
        analysisId?: string
    ): Promise<{ fileId: string; atomsResult: number; action: string }> {
        const resolvedAnalysisId = normalizeAnalysisId(analysisId);
        const objectName = this.buildObjectName(trajectoryId, resolvedAnalysisId, timestep, request, action);
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

        const filterResult = await this.getCombinedFilterResult(
            computeClusterId,
            storageClusterId,
            String(trajectoryId),
            resolvedAnalysisId || null,
            String(timestep),
            request
        );

        const response = await this.trajectoryNativeDaemonService.exportParticleFilterModel({
            teamClusterId: computeClusterId,
            trajectoryId: String(trajectoryId),
            timestep: Number(timestep),
            action,
            mask: filterResult.mask,
            objectKey: objectName,
            ownerClusterId: storageClusterId
        });
        const atomsResult = response.atomsResult;

        const firstCondition = request.conditions[0];
        const artifactParams = this.buildArtifactParams(request, action);

        await recordSceneArtifact(this.sceneArtifactRepository, {
            trajectory: String(trajectoryId),
            storageClusterId,
            analysis: resolvedAnalysisId,
            sourceType: SceneArtifactSourceType.ParticleFilter,
            timestep: Number(timestep),
            objectName,
            params: artifactParams,
            displayName: this.buildDisplayName(request, action, timestep),
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
        request: ParticleFilterRequest,
        action?: string,
        analysisId?: string
    ): Promise<Readable> {
        return (await this.getModelStreamResponse(
            trajectoryId,
            timestep,
            request,
            action,
            analysisId
        )).stream;
    }

    async getModelStreamResponse(
        trajectoryId: string,
        timestep: string | number,
        request: ParticleFilterRequest,
        action?: string,
        analysisId?: string
    ): Promise<TrajectoryNativeObjectStreamResponse> {
        const trajectory = await this.trajectoryRepository.findById(String(trajectoryId));
        const storageClusterId = trajectory
            ? resolveTrajectoryStorageClusterId(trajectory.props)
            : undefined;
        const actionPart = action || 'delete';
        const objectName = this.buildObjectName(
            trajectoryId,
            normalizeAnalysisId(analysisId),
            timestep,
            request,
            actionPart
        );

        if (storageClusterId) {
            return this.trajectoryNativeDaemonService.getObjectStreamResponse(
                storageClusterId,
                TEAM_CLUSTER_BUCKETS.MODELS,
                objectName
            );
        }

        throw buildClusterRequiredError();
    }

    private async getRemoteFilterResult(
        computeClusterId: string,
        storageClusterId: string,
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
            teamClusterId: computeClusterId,
            trajectoryId,
            timestep: Number(timestep),
            objectKey: this.dumpStorage.getObjectName(trajectoryId, timestep),
            ownerClusterId: storageClusterId,
            property: condition.property,
            operator: condition.operator,
            value: condition.value,
            ...(modifierSource ?? {})
        });
    }

    private async getCombinedFilterResult(
        computeClusterId: string,
        storageClusterId: string,
        trajectoryId: string,
        analysisId: string | null,
        timestep: string,
        request: ParticleFilterRequest
    ): Promise<{ mask: Uint8Array; matchCount: number; totalAtoms: number; }> {
        const results = await Promise.all(request.conditions.map((condition) => {
            return this.getRemoteFilterResult(
                computeClusterId,
                storageClusterId,
                trajectoryId,
                analysisId,
                timestep,
                condition
            );
        }));

        const firstResult = results[0];
        // Why: `new Uint8Array(firstResult.mask)` copies directly from the
        // source typed array in a single memcpy. The legacy path went through
        // `Array.from(...)` which boxed every byte into a number first.
        let combinedMask: Uint8Array = new Uint8Array(firstResult.mask);

        for (let index = 1; index < results.length; index += 1) {
            combinedMask = this.combineMasks(combinedMask, results[index].mask, request.combinator);
        }

        return {
            mask: combinedMask,
            matchCount: this.countMatches(combinedMask),
            totalAtoms: firstResult.totalAtoms
        };
    }

    /**
     * Combines two binary masks 32 bits at a time.
     *
     * Why: Uint8Array lane-wise iteration is bytecode-bound; casting to
     * Uint32Array lets the JIT emit a single native AND/OR per word (~4×
     * throughput on x86/ARM). The source byte offset must be a multiple of
     * 4 for the cast to be legal — our masks come from `new Uint8Array(n)`
     * so they are always backed by a fresh ArrayBuffer at offset 0.
     */
    private combineMasks(
        leftMask: Uint8Array,
        rightMask: Uint8Array,
        combinator: ParticleFilterCombinator
    ): Uint8Array {
        const length = leftMask.length;
        const combinedMask = new Uint8Array(length);
        const wordCount = length >>> 2;
        const tailStart = wordCount << 2;
        const isOr = combinator === ParticleFilterCombinator.Or;

        const alignedLeft = this.toU32View(leftMask, wordCount);
        const alignedRight = this.toU32View(rightMask, wordCount);
        const alignedOut = this.toU32View(combinedMask, wordCount);

        if (isOr) {
            for (let word = 0; word < wordCount; word++) {
                alignedOut[word] = alignedLeft[word] | alignedRight[word];
            }
        } else {
            for (let word = 0; word < wordCount; word++) {
                alignedOut[word] = alignedLeft[word] & alignedRight[word];
            }
        }

        if (isOr) {
            for (let index = tailStart; index < length; index++) {
                combinedMask[index] = leftMask[index] | rightMask[index];
            }
        } else {
            for (let index = tailStart; index < length; index++) {
                combinedMask[index] = leftMask[index] & rightMask[index];
            }
        }

        return combinedMask;
    }

    private toU32View(mask: Uint8Array, wordCount: number): Uint32Array {
        if ((mask.byteOffset % Uint32Array.BYTES_PER_ELEMENT) === 0) {
            return new Uint32Array(mask.buffer, mask.byteOffset, wordCount);
        }
        const aligned = new Uint8Array(mask.byteLength);
        aligned.set(mask);
        return new Uint32Array(aligned.buffer, 0, wordCount);
    }

    private countMatches(mask: Uint8Array): number {
        const length = mask.length;
        let count = 0;
        for (let index = 0; index < length; index++) {
            count += mask[index];
        }
        return count;
    }

    private buildObjectName(
        trajectoryId: string,
        analysisId: string | undefined,
        timestep: string | number,
        request: ParticleFilterRequest,
        action: string
    ): string {
        if (request.conditions.length === 1) {
            const condition = request.conditions[0];
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

        const filterHash = createHash('sha1').update(JSON.stringify(request)).digest('hex').slice(0, 12);
        const segment = analysisId || 'default';

        return `trajectory-${trajectoryId}/analysis-${segment}/glb/${timestep}/particle-filter/composite/${request.combinator.toLowerCase()}-${filterHash}-${action}.glb.zst`;
    }

    private buildArtifactParams(
        request: ParticleFilterRequest,
        action: string
    ): Record<string, unknown> {
        const firstCondition = request.conditions[0];
        const params: Record<string, unknown> = {
            combinator: request.combinator,
            conditions: request.conditions,
            action
        };

        if (request.conditions.length === 1 && firstCondition) {
            params.property = String(firstCondition.property);
            params.operator = String(firstCondition.operator);
            params.value = firstCondition.value;
            params.exposureId = firstCondition.exposureId;
        }

        return params;
    }

    private buildDisplayName(request: ParticleFilterRequest, action: string, timestep: string | number): string {
        const conditionsLabel = request.conditions.map((condition) => {
            const sourcePrefix = condition.exposureId ? `${condition.exposureId}:` : '';
            return `${sourcePrefix}${condition.property} ${condition.operator} ${condition.value}`;
        }).join(` ${request.combinator} `);

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
