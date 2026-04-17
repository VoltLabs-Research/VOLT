import { inject, injectable } from 'tsyringe';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import TeamClusterObjectGatewayClient from '@modules/team-cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import { createZstdDecompressionStream } from '@modules/trajectory/utilities/storage/trajectory-storage-codec';
import type { FrameMetadata } from '@modules/trajectory/domain/contracts/trajectory';

import { Readable } from 'node:stream';

interface TrajectoryNativeRequest {
    teamClusterId: string;
    trajectoryId: string;
    timestep: string | number;
    objectKey?: string;
    ownerClusterId?: string;
};

interface TrajectoryNativeModifierSource {
    analysisId?: string;
    exposureId?: string;
};

interface TrajectoryNativePropertyRequest extends TrajectoryNativeRequest {
    property: string;
};

interface TrajectoryNativeUniqueValuesRequest extends TrajectoryNativePropertyRequest {
    maxValues?: number;
};

interface TrajectoryNativeAtomsPageRequest extends TrajectoryNativeRequest {
    page: number;
    limit: number;
    analysisId?: string;
};

interface TrajectoryNativeConditionFilterPreviewRequest extends TrajectoryNativeRequest, TrajectoryNativeModifierSource {
    property: string;
    operator: string;
    value: number;
    externalValues?: Float32Array;
};
type TrajectoryNativeFilterPreviewRequest = TrajectoryNativeConditionFilterPreviewRequest;

interface TrajectoryNativeColorModelRequest extends TrajectoryNativePropertyRequest, TrajectoryNativeModifierSource {
    objectKey: string;
    startValue: number;
    endValue: number;
    gradient: string;
    externalValues?: Float32Array;
};

interface TrajectoryNativeParticleFilterRequest extends TrajectoryNativeRequest {
    objectKey: string;
    action: 'delete' | 'highlight';
    mask: Uint8Array;
};

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
};

interface TrajectoryNativeFilterPreviewResponse {
    maskBase64: string;
    matchCount: number;
    totalAtoms: number;
};

@injectable()
export default class TrajectoryNativeDaemonService {
    constructor(
        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,

        @inject(SHARED_TOKENS.TeamClusterObjectGatewayClient)
        private readonly objectGatewayClient: TeamClusterObjectGatewayClient
    ) {}

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
                externalValuesBase64: input.externalValues
                    ? Buffer.from(input.externalValues.buffer, input.externalValues.byteOffset, input.externalValues.byteLength).toString('base64')
                    : undefined
            }
        );

        return {
            mask: new Uint8Array(Buffer.from(response.maskBase64, 'base64')),
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
            externalValuesBase64: input.externalValues
                ? Buffer.from(input.externalValues.buffer, input.externalValues.byteOffset, input.externalValues.byteLength).toString('base64')
                : undefined
        });
    }

    async exportParticleFilterModel(input: TrajectoryNativeParticleFilterRequest): Promise<{ atomsResult: number; }> {
        return this.teamClusterDaemonClient.command(input.teamClusterId, ChannelCommands.TrajectoryNativeParticleFilterModel, {
            ...this.toBaseBody(input),
            objectKey: input.objectKey,
            action: input.action,
            maskBase64: Buffer.from(input.mask).toString('base64')
        });
    }

    async getObjectBuffer(teamClusterId: string, bucket: string, objectKey: string): Promise<Buffer> {
        return this.objectGatewayClient.getBuffer(teamClusterId, bucket, objectKey);
    }

    async getObjectStream(teamClusterId: string, bucket: string, objectKey: string): Promise<Readable> {
        const response = await this.objectGatewayClient.getStream(teamClusterId, bucket, objectKey);
        if (objectKey.endsWith('.zst') || response.contentEncoding === 'zstd') {
            const decompressed = createZstdDecompressionStream(response.stream);
            void decompressed.completion;
            return decompressed.stream;
        }

        return response.stream;
    }

    private toBaseBody(input: TrajectoryNativeRequest): Record<string, unknown> {
        return {
            trajectoryId: input.trajectoryId,
            timestep: Number(input.timestep),
            objectKey: input.objectKey,
            ownerClusterId: input.ownerClusterId
        };
    }
};
