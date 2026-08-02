import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import { SceneArtifactSourceType } from '@shared/contracts/types/SceneArtifact';
import type { TrajectoryNativeObjectStreamResponse } from '@modules/trajectory/services/native/TrajectoryNativeTypes';
import {
    buildClusterRequiredError,
    recordSceneArtifact,
    resolveSceneArtifactExecutionContext
} from '@modules/trajectory/services/SceneArtifactService';
import { combineMasks, countMatches } from '@modules/trajectory/services/particle-filter/ParticleFilterMask';
import {
    buildParticleFilterArtifactParams,
    buildParticleFilterDisplayName,
    buildParticleFilterObjectName
} from '@modules/trajectory/services/particle-filter/ParticleFilterNaming';
import type {
    ParticleFilterCondition,
    ParticleFilterRequest
} from '@modules/trajectory/services/particle-filter/ParticleFilterRequest';
import { normalizeAnalysisId } from '@modules/trajectory/services/trajectory/TrajectoryAnalysis';
import ApplicationError from '@shared/application/errors/ApplicationError';

import Trajectory from '@modules/trajectory/models/Trajectory';
import atomPropertiesService from '@modules/trajectory/services/trajectory/AtomPropertiesService';
import { buildTrajectoryDumpObjectName } from '@modules/trajectory/services/trajectory/TrajectoryStoragePaths';
import trajectoryNativeDaemonService, {
    resolveTrajectoryNativeClusterContext
} from '@modules/trajectory/services/native/TrajectoryNativeDaemonService';

import { ParticleFilterCombinator } from '@volt/contracts/modules/trajectory/http';

export { ParticleFilterCombinator };
export { buildParticleFilterRequest } from '@modules/trajectory/services/particle-filter/ParticleFilterRequest';

interface ParticleFilterResult {
    mask: Uint8Array;
    matchCount: number;
    totalAtoms: number;
}

class ParticleFilterService {
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
        const clusterContext = await resolveTrajectoryNativeClusterContext(trajectoryId);

        if (!clusterContext) {
            throw buildClusterRequiredError();
        }

        const metadata = await trajectoryNativeDaemonService.getTrajectoryMetadata({
            teamClusterId: clusterContext.computeClusterId,
            trajectoryId,
            timestep: Number(timestep),
            objectKey: buildTrajectoryDumpObjectName(trajectoryId, timestep),
            ownerClusterId: clusterContext.storageClusterId
        });

        const modifierProps: Record<string, string[]> = {};
        const perAtomTypes: Record<string, Record<string, 'number' | 'string'>> = {};
        const exposureNames: Record<string, string> = {};

        if (resolvedAnalysisId) {
            const configs = await atomPropertiesService.getAnalysisExposureAtomConfigs(
                resolvedAnalysisId,
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
            dump: metadata.headers,
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
        const clusterContext = await resolveTrajectoryNativeClusterContext(trajectoryId);

        if (exposureId && resolvedAnalysisId) {
            return atomPropertiesService.getModifierUniqueValues(
                trajectoryId,
                resolvedAnalysisId,
                exposureId,
                String(timestep),
                property,
                maxValues
            );
        }

        if (!clusterContext) {
            throw buildClusterRequiredError();
        }

        return trajectoryNativeDaemonService.getUniqueValues({
            teamClusterId: clusterContext.computeClusterId,
            trajectoryId,
            timestep: Number(timestep),
            objectKey: buildTrajectoryDumpObjectName(trajectoryId, timestep),
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
        const trajectory = await Trajectory.findOneBy({ id: trajectoryId });

        if (!trajectory) {
            throw buildClusterRequiredError();
        }

        const storageClusterId = trajectory.storageClusterId;
        const computeClusterId = await teamClusterSelectionService.resolveComputeClusterId(
            trajectory.team,
            undefined,
            storageClusterId
        );

        const result = await this.getCombinedFilterResult(
            computeClusterId,
            storageClusterId,
            trajectoryId,
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
        const objectName = buildParticleFilterObjectName(
            trajectoryId,
            resolvedAnalysisId,
            timestep,
            request,
            action
        );
        const {
            computeClusterId,
            storageClusterId
        } = await resolveSceneArtifactExecutionContext({
            trajectoryId,
            timestep: String(timestep),
            analysisId: resolvedAnalysisId
        });

        const filterResult = await this.getCombinedFilterResult(
            computeClusterId,
            storageClusterId,
            trajectoryId,
            resolvedAnalysisId || null,
            String(timestep),
            request
        );

        const response = await trajectoryNativeDaemonService.exportParticleFilterModel({
            teamClusterId: computeClusterId,
            trajectoryId,
            timestep: Number(timestep),
            action,
            mask: filterResult.mask,
            objectKey: objectName,
            ownerClusterId: storageClusterId
        });
        const atomsResult = response.atomsResult;

        const firstCondition = request.conditions[0];

        await recordSceneArtifact({
            trajectory: trajectoryId,
            storageClusterId,
            analysis: resolvedAnalysisId,
            sourceType: SceneArtifactSourceType.ParticleFilter,
            timestep: Number(timestep),
            objectName,
            params: buildParticleFilterArtifactParams(request, action),
            displayName: buildParticleFilterDisplayName(request, action, timestep),
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

    async getModelStreamResponse(
        trajectoryId: string,
        timestep: string | number,
        request: ParticleFilterRequest,
        action?: string,
        analysisId?: string
    ): Promise<TrajectoryNativeObjectStreamResponse> {
        const trajectory = await Trajectory.findOneBy({ id: trajectoryId });

        if (!trajectory) {
            throw buildClusterRequiredError();
        }

        const objectName = buildParticleFilterObjectName(
            trajectoryId,
            normalizeAnalysisId(analysisId),
            timestep,
            request,
            action || 'delete'
        );

        return trajectoryNativeDaemonService.getObjectStreamResponse(
            trajectory.storageClusterId,
            TEAM_CLUSTER_BUCKETS.MODELS,
            objectName
        );
    }

    private async getRemoteFilterResult(
        computeClusterId: string,
        storageClusterId: string,
        trajectoryId: string,
        analysisId: string | null,
        timestep: string,
        condition: ParticleFilterCondition
    ): Promise<ParticleFilterResult> {
        const modifierSource = await this.resolveRemoteModifierSource(
            analysisId,
            condition.exposureId,
            timestep,
            condition.property
        );

        return trajectoryNativeDaemonService.previewFilter({
            teamClusterId: computeClusterId,
            trajectoryId,
            timestep: Number(timestep),
            objectKey: buildTrajectoryDumpObjectName(trajectoryId, timestep),
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
    ): Promise<ParticleFilterResult> {
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
        let combinedMask: Uint8Array = new Uint8Array(firstResult.mask);

        for (let index = 1; index < results.length; index += 1) {
            combinedMask = combineMasks(combinedMask, results[index].mask, request.combinator);
        }

        return {
            mask: combinedMask,
            matchCount: countMatches(combinedMask),
            totalAtoms: firstResult.totalAtoms
        };
    }

    /**
     * A condition without an exposure filters a raw dump property, so a missing
     * analysis/exposure pair is a valid shape here and not an error.
     */
    private async resolveRemoteModifierSource(
        analysisId: string | null,
        exposureId: string | undefined,
        timestep: string,
        property: string
    ): Promise<{ analysisId: string; exposureId: string; } | undefined> {
        if (!analysisId || !exposureId) {
            return undefined;
        }

        await atomPropertiesService.assertExposurePublishesProperty(analysisId, exposureId, timestep, property);

        return {
            analysisId,
            exposureId
        };
    }
}

export default new ParticleFilterService();
