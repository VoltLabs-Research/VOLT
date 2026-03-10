import { inject, injectable } from 'tsyringe';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';

import { Readable } from 'node:stream';

import type { FrameMetadata } from '@modules/trajectory/domain/contracts/trajectory';

interface TrajectoryNativeRequest {
    teamClusterId: string;
    trajectoryId: string;
    timestep: string | number;
    objectKey?: string;
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
};

interface TrajectoryNativeFilterPreviewRequest extends TrajectoryNativeRequest {
    property: string;
    operator: string;
    value: number;
    externalValues?: Float32Array;
};

interface TrajectoryNativeColorModelRequest extends TrajectoryNativePropertyRequest {
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
    }>;
    totalAtoms: number;
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
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
    ) {}

    async preprocessTrajectory(input: TrajectoryNativeRequest): Promise<void> {
        await this.teamClusterDaemonClient.command(input.teamClusterId, 'trajectory.native.preprocess', this.toBaseBody(input));
    }

    async getTrajectoryMetadata(input: TrajectoryNativeRequest): Promise<FrameMetadata> {
        return this.teamClusterDaemonClient.command(input.teamClusterId, 'trajectory.native.metadata', this.toBaseBody(input));
    }

    async getPropertyStats(input: TrajectoryNativePropertyRequest): Promise<{ min: number; max: number; }> {
        return this.teamClusterDaemonClient.command(input.teamClusterId, 'trajectory.native.property-stats', {
            ...this.toBaseBody(input),
            property: input.property
        });
    }

    async getUniqueValues(input: TrajectoryNativeUniqueValuesRequest): Promise<number[]> {
        return this.teamClusterDaemonClient.command(input.teamClusterId, 'trajectory.native.unique-values', {
            ...this.toBaseBody(input),
            property: input.property,
            maxValues: input.maxValues
        });
    }

    async getAtomsPage(input: TrajectoryNativeAtomsPageRequest): Promise<TrajectoryNativeAtomsPageResponse> {
        return this.teamClusterDaemonClient.command(input.teamClusterId, 'trajectory.native.atoms', {
            ...this.toBaseBody(input),
            page: input.page,
            limit: input.limit
        });
    }

    async previewFilter(input: TrajectoryNativeFilterPreviewRequest): Promise<{ mask: Uint8Array; matchCount: number; totalAtoms: number; }> {
        const response = await this.teamClusterDaemonClient.command<TrajectoryNativeFilterPreviewResponse>(
            input.teamClusterId,
            'trajectory.native.filter-preview',
            {
                ...this.toBaseBody(input),
                property: input.property,
                operator: input.operator,
                value: input.value,
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
        await this.teamClusterDaemonClient.command(input.teamClusterId, 'trajectory.native.color-model', {
            ...this.toBaseBody(input),
            property: input.property,
            objectKey: input.objectKey,
            startValue: input.startValue,
            endValue: input.endValue,
            gradient: input.gradient,
            externalValuesBase64: input.externalValues
                ? Buffer.from(input.externalValues.buffer, input.externalValues.byteOffset, input.externalValues.byteLength).toString('base64')
                : undefined
        });
    }

    async exportParticleFilterModel(input: TrajectoryNativeParticleFilterRequest): Promise<{ atomsResult: number; }> {
        return this.teamClusterDaemonClient.command(input.teamClusterId, 'trajectory.native.particle-filter-model', {
            ...this.toBaseBody(input),
            objectKey: input.objectKey,
            action: input.action,
            maskBase64: Buffer.from(input.mask).toString('base64')
        });
    }

    async getObjectBuffer(teamClusterId: string, bucket: string, objectKey: string): Promise<Buffer> {
        return this.teamClusterDaemonClient.commandBuffer(teamClusterId, 'object.get', {
            bucket,
            objectKey
        });
    }

    async getObjectStream(teamClusterId: string, bucket: string, objectKey: string): Promise<Readable> {
        return this.teamClusterDaemonClient.commandStream(teamClusterId, 'object.get', {
            bucket,
            objectKey
        });
    }

    private toBaseBody(input: TrajectoryNativeRequest): Record<string, unknown> {
        return {
            trajectoryId: input.trajectoryId,
            timestep: Number(input.timestep),
            objectKey: input.objectKey
        };
    }
};
