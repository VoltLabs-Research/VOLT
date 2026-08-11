import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import { SceneArtifactSourceType } from '@shared/contracts/types/SceneArtifact';
import type { SceneArtifactParams } from '@volt/contracts/modules/trajectory/domain';
import type { TrajectoryNativeObjectStreamResponse } from '@modules/trajectory/services/native/TrajectoryNativeTypes';
import {
    buildClusterRequiredError,
    recordSceneArtifact,
    resolveSceneArtifactExecutionContext
} from '@modules/trajectory/services/SceneArtifactService';
import { normalizeAnalysisId } from '@modules/trajectory/services/trajectory/TrajectoryAnalysis';
import { formatValueForPath } from '@shared/infrastructure/utilities/format-value';
import ApplicationError from '@shared/application/errors/ApplicationError';

import Trajectory from '@modules/trajectory/models/Trajectory';
import atomPropertiesService from '@modules/trajectory/services/trajectory/AtomPropertiesService';
import { buildTrajectoryDumpObjectName } from '@modules/trajectory/services/trajectory/TrajectoryStoragePaths';
import trajectoryNativeDaemonService, {
    resolveTrajectoryNativeClusterContext
} from '@modules/trajectory/services/native/TrajectoryNativeDaemonService';

const DEFAULT_ANALYSIS_ID = 'default';

interface ColorCodingObjectNameParams{
    trajectoryId: string;
    analysisSegment?: string;
    timestep: string | number;
    exposureId?: string;
    property: string;
    startValue: number;
    endValue: number;
    gradient: string;
}

const buildColorCodingObjectName = ({
    trajectoryId,
    analysisSegment,
    timestep,
    exposureId,
    property,
    startValue,
    endValue,
    gradient
}: ColorCodingObjectNameParams): string => {
    const segment = analysisSegment || DEFAULT_ANALYSIS_ID;
    const formattedStart = formatValueForPath(startValue);
    const formattedEnd = formatValueForPath(endValue);
    return `trajectory-${trajectoryId}/analysis-${segment}/glb/${timestep}/color-coding/${exposureId || 'base'}/${property}/${formattedStart}-${formattedEnd}/${gradient}.glb.zst`;
};

class ColorCodingService {
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
        const modifierTypes: Record<string, Record<string, 'number' | 'string'>> = {};
        if (resolvedAnalysisId) {
            const configs = await atomPropertiesService.getAnalysisExposureAtomConfigs(
                resolvedAnalysisId,
                String(timestep)
            );
            for (const config of configs) {
                if (config.perAtomProperties.length === 0) continue;
                modifierProps[config.exposureId] = config.perAtomProperties;
                modifierTypes[config.exposureId] = config.perAtomPropertyTypes;
            }
        }

        return {
            base: metadata.headers,
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

            await atomPropertiesService.assertExposurePublishesProperty(
                resolvedAnalysisId,
                exposureId,
                String(timestep),
                property
            );
            const stats = await atomPropertiesService.getModifierStats(
                trajectoryId,
                resolvedAnalysisId,
                exposureId,
                String(timestep),
                property
            );
            if (stats) {
                min = stats.min;
                max = stats.max;
            }
        } else {
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
            const propIdx = metadata.headers.indexOf(property.toLowerCase());

            if (propIdx !== -1) {
                const stats = await trajectoryNativeDaemonService.getPropertyStats({
                    teamClusterId: clusterContext.computeClusterId,
                    trajectoryId,
                    timestep: Number(timestep),
                    objectKey: buildTrajectoryDumpObjectName(trajectoryId, timestep),
                    ownerClusterId: clusterContext.storageClusterId,
                    property
                });
                if (stats) {
                    return {
                        min: stats.min,
                        max: stats.max
                    };
                }
            }
        }

        if (min === Infinity) min = 0;
        if (max === -Infinity) max = 0;

        return {
            min,
            max
        };
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
        const objectName = buildColorCodingObjectName({
            trajectoryId,
            analysisSegment: resolvedAnalysisId,
            timestep,
            exposureId,
            property,
            startValue,
            endValue,
            gradient
        });
        const {
            computeClusterId,
            storageClusterId
        } = await resolveSceneArtifactExecutionContext({
            trajectoryId,
            timestep: String(timestep),
            analysisId: resolvedAnalysisId
        });

        const modifierSource = exposureId && resolvedAnalysisId
            ? {
                analysisId: resolvedAnalysisId,
                exposureId
            }
            : undefined;

        if (modifierSource) {
            await atomPropertiesService.assertExposurePublishesProperty(
                modifierSource.analysisId,
                modifierSource.exposureId,
                String(timestep),
                property
            );
        }

        await trajectoryNativeDaemonService.exportColoredModel({
            teamClusterId: computeClusterId,
            trajectoryId,
            timestep: Number(timestep),
            property,
            startValue,
            endValue,
            gradient,
            objectKey: objectName,
            ownerClusterId: storageClusterId,
            ...(modifierSource ?? {})
        });

        await recordSceneArtifact({
            trajectory: trajectoryId,
            storageClusterId,
            analysis: resolvedAnalysisId,
            sourceType: SceneArtifactSourceType.ColorCoding,
            timestep: Number(timestep),
            objectName,
            params: {
                property,
                startValue,
                endValue,
                gradient,
                exposureId
            } as SceneArtifactParams,
            displayName: `CC · ${property} · [${startValue}, ${endValue}] · ${gradient} · t=${timestep}`,
            metadata: {
                analysisId: resolvedAnalysisId || null,
                exposureId: exposureId || null
            }
        });

        return objectName;
    }

    async getModelStreamResponse(
        trajectoryId: string,
        timestep: string | number,
        property: string,
        startValue: number,
        endValue: number,
        gradient: string,
        analysisId?: string,
        exposureId?: string
    ): Promise<TrajectoryNativeObjectStreamResponse> {
        const trajectory = await Trajectory.findOneBy({ id: trajectoryId });

        if (!trajectory) {
            throw buildClusterRequiredError();
        }

        const objectName = buildColorCodingObjectName({
            trajectoryId,
            analysisSegment: normalizeAnalysisId(analysisId),
            timestep,
            exposureId,
            property,
            startValue,
            endValue,
            gradient
        });

        return trajectoryNativeDaemonService.getObjectStreamResponse(
            trajectory.storageClusterId,
            TEAM_CLUSTER_BUCKETS.MODELS,
            objectName
        );
    }
}

export default new ColorCodingService();
