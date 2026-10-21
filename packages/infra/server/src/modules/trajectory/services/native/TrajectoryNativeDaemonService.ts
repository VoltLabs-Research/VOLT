import objectGatewayClient from '@modules/cluster/services/object-gateway/TeamClusterObjectGatewayClient';
import teamClusterDaemonClient from '@modules/cluster/services/team-cluster/TeamClusterDaemonClient';
import Trajectory from '@modules/trajectory/models/Trajectory';
import type { TrajectoryNativeObjectStreamResponse } from '@modules/trajectory/services/native/TrajectoryNativeTypes';
import teamClusterSelectionService from '@modules/cluster/services/team-cluster/TeamClusterSelectionService';
import { toBytes } from '@voltstack/daemon-cluster-client';
import { DaemonCommand } from '@volt/contracts/modules/cluster/daemon-commands';
import type {
    NativeAtomsPage,
    NativeFrameMetadata,
    NativeFilterPreview
} from '@volt/contracts/modules/trajectory/daemon';

interface TrajectoryNativeRequest {
    teamClusterId: string;
    trajectoryId: string;
    timestep: string | number;
    objectKey?: string;
    ownerClusterId?: string;
}

interface TrajectoryNativeModifierSource {
    analysisId?: string;
    exposureId?: string;
}

interface TrajectoryNativeModifierBodySource extends TrajectoryNativeModifierSource {
    externalValues?: Float32Array;
}

interface TrajectoryNativePropertyRequest extends TrajectoryNativeRequest {
    property: string;
}

interface TrajectoryNativeUniqueValuesRequest extends TrajectoryNativePropertyRequest {
    maxValues?: number;
}

interface TrajectoryNativeAtomsPageRequest extends TrajectoryNativeRequest {
    page: number;
    limit: number;
    analysisId?: string;
}

interface TrajectoryNativeConditionFilterPreviewRequest extends TrajectoryNativeRequest, TrajectoryNativeModifierSource {
    property: string;
    operator: string;
    value: number | string;
    externalValues?: Float32Array;
}

interface TrajectoryNativeColorModelRequest extends TrajectoryNativePropertyRequest, TrajectoryNativeModifierSource {
    objectKey: string;
    startValue: number;
    endValue: number;
    gradient: string;
    externalValues?: Float32Array;
}

interface TrajectoryNativeParticleFilterRequest extends TrajectoryNativeRequest {
    objectKey: string;
    action: 'delete' | 'highlight';
    mask: Uint8Array;
}

interface TrajectoryNativeClusterContext {
    trajectory: Trajectory;
    storageClusterId: string;
    computeClusterId: string;
}

export const resolveTrajectoryNativeClusterContext = async (
    trajectoryId: string
): Promise<TrajectoryNativeClusterContext | null> => {
    const trajectory = await Trajectory.findOneBy({ id: trajectoryId });

    if (!trajectory) {
        return null;
    }

    const storageClusterId = trajectory.storageClusterId;
    const computeClusterId = await teamClusterSelectionService.resolveComputeClusterId(
        trajectory.team,
        undefined,
        storageClusterId
    );

    return {
        trajectory,
        storageClusterId,
        computeClusterId
    };
};

class TrajectoryNativeDaemonService {
    async getTrajectoryMetadata(input: TrajectoryNativeRequest): Promise<NativeFrameMetadata> {
        return teamClusterDaemonClient.command(
            input.teamClusterId,
            DaemonCommand.TrajectoryNativeMetadata,
            this.toBaseBody(input)
        );
    }

    async getPropertyStats(input: TrajectoryNativePropertyRequest): Promise<{ min: number; max: number; }> {
        return teamClusterDaemonClient.command(input.teamClusterId, DaemonCommand.TrajectoryNativePropertyStats, {
            ...this.toBaseBody(input),
            property: input.property
        });
    }

    async getUniqueValues(input: TrajectoryNativeUniqueValuesRequest): Promise<number[]> {
        return teamClusterDaemonClient.command(input.teamClusterId, DaemonCommand.TrajectoryNativeUniqueValues, {
            ...this.toBaseBody(input),
            property: input.property,
            maxValues: input.maxValues
        });
    }

    async getAtomsPage(input: TrajectoryNativeAtomsPageRequest): Promise<NativeAtomsPage> {
        return teamClusterDaemonClient.command(input.teamClusterId, DaemonCommand.TrajectoryNativeAtoms, {
            ...this.toBaseBody(input),
            page: input.page,
            limit: input.limit,
            ...(input.analysisId ? { analysisId: input.analysisId } : {})
        });
    }

    async previewFilter(input: TrajectoryNativeConditionFilterPreviewRequest): Promise<NativeFilterPreview> {
        const response = await teamClusterDaemonClient.command<NativeFilterPreview>(
            input.teamClusterId,
            DaemonCommand.TrajectoryNativeFilterPreview,
            {
                ...this.toBaseBody(input),
                property: input.property,
                operator: input.operator,
                value: input.value,
                ...this.toModifierBody(input)
            }
        );

        return {
            mask: toBytes(response.mask),
            matchCount: response.matchCount,
            totalAtoms: response.totalAtoms
        };
    }

    async exportColoredModel(input: TrajectoryNativeColorModelRequest): Promise<void> {
        await teamClusterDaemonClient.command(input.teamClusterId, DaemonCommand.TrajectoryNativeColorModel, {
            ...this.toBaseBody(input),
            property: input.property,
            objectKey: input.objectKey,
            startValue: input.startValue,
            endValue: input.endValue,
            gradient: input.gradient,
            ...this.toModifierBody(input)
        });
    }

    async exportParticleFilterModel(input: TrajectoryNativeParticleFilterRequest): Promise<{ atomsResult: number; }> {
        return teamClusterDaemonClient.command(input.teamClusterId, DaemonCommand.TrajectoryNativeParticleFilterModel, {
            ...this.toBaseBody(input),
            objectKey: input.objectKey,
            action: input.action,
            mask: input.mask
        });
    }

    private floatArrayToBytes(floats: Float32Array): Uint8Array {
        return new Uint8Array(floats.buffer, floats.byteOffset, floats.byteLength);
    }

    private toModifierBody(input: TrajectoryNativeModifierBodySource): Record<string, unknown> {
        return {
            ...(input.analysisId ? { analysisId: input.analysisId } : {}),
            ...(input.exposureId ? { exposureId: input.exposureId } : {}),
            ...(input.externalValues ? { externalValues: this.floatArrayToBytes(input.externalValues) } : {})
        };
    }

    async getObjectStreamResponse(teamClusterId: string, bucket: string, objectKey: string): Promise<TrajectoryNativeObjectStreamResponse> {
        const response = await objectGatewayClient.getStream(teamClusterId, bucket, objectKey);
        return {
            stream: response.stream,
            contentEncoding: response.contentEncoding || (objectKey.endsWith('.zst') ? 'zstd' : undefined),
            contentLength: response.contentLength
        };
    }

    private toBaseBody(input: TrajectoryNativeRequest): Record<string, unknown> {
        return {
            trajectoryId: input.trajectoryId,
            timestep: Number(input.timestep),
            objectKey: input.objectKey,
            ownerClusterId: input.ownerClusterId
        };
    }
}

export default new TrajectoryNativeDaemonService();
