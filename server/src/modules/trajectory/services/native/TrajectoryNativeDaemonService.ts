import objectGatewayClientSingleton from '@modules/cluster/services/object-gateway/TeamClusterObjectGatewayClient';
import teamClusterDaemonClient from '@modules/cluster/services/team-cluster/TeamClusterDaemonClient';
import Trajectory from '@modules/trajectory/models/Trajectory';
import type {
    AtomPageResult,
    FrameMetadata,
    TrajectoryNativeObjectStreamResponse
} from '@modules/trajectory/services/native/TrajectoryNativeTypes';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { toUint8Array } from '@shared/infrastructure/types/reverseChannelBinary';

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

interface TrajectoryNativeFilterPreviewResponse {
    mask: Uint8Array;
    matchCount: number;
    totalAtoms: number;
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
    private readonly teamClusterDaemonClient = teamClusterDaemonClient;

    private readonly objectGatewayClient = objectGatewayClientSingleton;

    async getTrajectoryMetadata(input: TrajectoryNativeRequest): Promise<FrameMetadata> {
        return this.teamClusterDaemonClient.command(
            input.teamClusterId,
            ChannelCommands.TrajectoryNativeMetadata,
            this.toBaseBody(input)
        );
    }

    async getPropertyStats(input: TrajectoryNativePropertyRequest): Promise<{ min: number; max: number; }> {
        return this.teamClusterDaemonClient.command(input.teamClusterId, ChannelCommands.TrajectoryNativePropertyStats, {
            ...this.toBaseBody(input),
            property: input.property
        });
    }

    async getUniqueValues(input: TrajectoryNativeUniqueValuesRequest): Promise<number[]> {
        return this.teamClusterDaemonClient.command(input.teamClusterId, ChannelCommands.TrajectoryNativeUniqueValues, {
            ...this.toBaseBody(input),
            property: input.property,
            maxValues: input.maxValues
        });
    }

    async getAtomsPage(input: TrajectoryNativeAtomsPageRequest): Promise<AtomPageResult> {
        return this.teamClusterDaemonClient.command(input.teamClusterId, ChannelCommands.TrajectoryNativeAtoms, {
            ...this.toBaseBody(input),
            page: input.page,
            limit: input.limit,
            ...(input.analysisId ? { analysisId: input.analysisId } : {})
        });
    }

    async previewFilter(input: TrajectoryNativeConditionFilterPreviewRequest): Promise<TrajectoryNativeFilterPreviewResponse> {
        const response = await this.teamClusterDaemonClient.command<TrajectoryNativeFilterPreviewResponse>(
            input.teamClusterId,
            ChannelCommands.TrajectoryNativeFilterPreview,
            {
                ...this.toBaseBody(input),
                property: input.property,
                operator: input.operator,
                value: input.value,
                ...this.toModifierBody(input)
            }
        );

        return {
            mask: toUint8Array(response.mask),
            matchCount: response.matchCount,
            totalAtoms: response.totalAtoms
        };
    }

    async exportColoredModel(input: TrajectoryNativeColorModelRequest): Promise<void> {
        await this.teamClusterDaemonClient.command(input.teamClusterId, ChannelCommands.TrajectoryNativeColorModel, {
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
        return this.teamClusterDaemonClient.command(input.teamClusterId, ChannelCommands.TrajectoryNativeParticleFilterModel, {
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
        const response = await this.objectGatewayClient.getStream(teamClusterId, bucket, objectKey);
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
