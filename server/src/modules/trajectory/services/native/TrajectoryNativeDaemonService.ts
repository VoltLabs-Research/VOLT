import type { ITeamClusterObjectGatewayClient } from '@shared/contracts/ports';
import { CLUSTER_ACCESS_TOKENS } from '@shared/contracts/tokens';
import type { FrameMetadata } from '@modules/trajectory/contracts/trajectory';
import type {
    LineExportBaseOptions,
    LineStyleFilterParam,
    LineStyleParams,
    TrajectoryNativeLineModelResponse,
    TrajectoryNativeObjectStreamResponse
} from '@modules/trajectory/contracts/native';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { container as diContainer } from 'tsyringe';

import { toUint8Array } from '@shared/infrastructure/types/reverseChannelBinary';
import { Readable } from 'node:stream';

export type {
    LineExportBaseOptions,
    LineStyleFilterParam,
    LineStyleParams,
    TrajectoryNativeLineModelResponse,
    TrajectoryNativeObjectStreamResponse
} from '@modules/trajectory/contracts/native';

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
type TrajectoryNativeFilterPreviewRequest = TrajectoryNativeConditionFilterPreviewRequest;

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

interface TrajectoryNativeLineModelRequest extends TrajectoryNativeRequest {
    objectKey: string;
    analysisId: string;
    exposureId: string;
    baseOptions?: LineExportBaseOptions;
    style?: LineStyleParams;
}

interface TrajectoryNativeAtomsPageResponse {
    atoms: Array<{
        id: number;
        type: number;
        x: number;
        y: number;
        z: number;
        [property: string]: number;
    }>;
    totalAtoms: number;
    nativeProperties: string[];
    analysisPropertyNames?: string[];
    analysisAtoms?: Record<string, unknown>[];
}

interface TrajectoryNativeFilterPreviewResponse {
    mask: Uint8Array;
    matchCount: number;
    totalAtoms: number;
}

export class TrajectoryNativeDaemonService {
    #teamClusterDaemonClientCache?: TeamClusterDaemonClient;
    private get teamClusterDaemonClient(): TeamClusterDaemonClient {
        return (this.#teamClusterDaemonClientCache ??= diContainer.resolve(TeamClusterDaemonClient));
    }

    #objectGatewayClientCache?: ITeamClusterObjectGatewayClient;
    private get objectGatewayClient(): ITeamClusterObjectGatewayClient {
        return (this.#objectGatewayClientCache ??= diContainer.resolve<ITeamClusterObjectGatewayClient>(CLUSTER_ACCESS_TOKENS.TeamClusterObjectGatewayClient));
    }

    async preprocessTrajectory(input: TrajectoryNativeRequest): Promise<void> {
        await this.teamClusterDaemonClient.command(
            input.teamClusterId,
            ChannelCommands.TrajectoryNativePreprocess,
            this.toBaseBody(input)
        );
    }

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

    async getAtomIds(input: TrajectoryNativeRequest): Promise<number[]> {
        return this.teamClusterDaemonClient.command(input.teamClusterId, ChannelCommands.TrajectoryNativeAtomIds, {
            ...this.toBaseBody(input)
        });
    }

    async getAtomsPage(input: TrajectoryNativeAtomsPageRequest): Promise<TrajectoryNativeAtomsPageResponse> {
        return this.teamClusterDaemonClient.command(input.teamClusterId, ChannelCommands.TrajectoryNativeAtoms, {
            ...this.toBaseBody(input),
            page: input.page,
            limit: input.limit,
            ...(input.analysisId ? { analysisId: input.analysisId } : {})
        });
    }

    async previewFilter(input: TrajectoryNativeFilterPreviewRequest): Promise<{ mask: Uint8Array; matchCount: number; totalAtoms: number; }> {
        const response = await this.teamClusterDaemonClient.command<TrajectoryNativeFilterPreviewResponse>(
            input.teamClusterId,
            ChannelCommands.TrajectoryNativeFilterPreview,
            {
                ...this.toBaseBody(input),
                property: input.property,
                operator: input.operator,
                value: input.value,
                ...(input.analysisId ? { analysisId: input.analysisId } : {}),
                ...(input.exposureId ? { exposureId: input.exposureId } : {}),
                ...(input.externalValues ? { externalValues: this.floatArrayToBytes(input.externalValues) } : {})
            }
        );

        return {
            mask: toUint8Array(response.mask as unknown as Uint8Array | ArrayBuffer | Buffer),
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
            ...(input.analysisId ? { analysisId: input.analysisId } : {}),
            ...(input.exposureId ? { exposureId: input.exposureId } : {}),
            ...(input.externalValues ? { externalValues: this.floatArrayToBytes(input.externalValues) } : {})
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

    async exportLineModel(input: TrajectoryNativeLineModelRequest): Promise<TrajectoryNativeLineModelResponse> {
        return this.teamClusterDaemonClient.command(input.teamClusterId, ChannelCommands.TrajectoryNativeLineModel, {
            ...this.toBaseBody(input),
            objectKey: input.objectKey,
            analysisId: input.analysisId,
            exposureId: input.exposureId,
            ...(input.baseOptions ? { baseOptions: input.baseOptions } : {}),
            ...(input.style ? { style: input.style } : {})
        });
    }

    private floatArrayToBytes(floats: Float32Array): Uint8Array {
        return new Uint8Array(floats.buffer, floats.byteOffset, floats.byteLength);
    }

    async getObjectBuffer(teamClusterId: string, bucket: string, objectKey: string): Promise<Buffer> {
        return this.objectGatewayClient.getBuffer(teamClusterId, bucket, objectKey);
    }

    async getObjectStream(teamClusterId: string, bucket: string, objectKey: string): Promise<Readable> {
        return (await this.getObjectStreamResponse(teamClusterId, bucket, objectKey)).stream;
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
