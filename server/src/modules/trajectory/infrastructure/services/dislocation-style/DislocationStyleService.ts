import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import { TeamClusterSelectionService } from '@modules/container/infrastructure/services/TeamClusterSelectionService';
import { resolveTrajectoryStorageClusterId } from '@modules/cluster/application/utilities/cluster-location';
import { SceneArtifactSourceType } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import TrajectoryNativeDaemonService from '@modules/trajectory/infrastructure/services/native/TrajectoryNativeDaemonService';
import { recordSceneArtifact } from '@modules/trajectory/utilities/scene-artifacts/record-scene-artifact';
import { resolveSceneArtifactExecutionContext } from '@modules/trajectory/utilities/scene-artifacts/resolve-scene-artifact-execution-context';
import { buildDislocationStyleObjectName } from '@modules/trajectory/utilities/trajectory/minio-path-builder';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Singleton } from '@shared/infrastructure/di/decorators';

import AnalysisRepository from '@modules/analysis/infrastructure/persistence/mongo/repositories/AnalysisRepository';
import SceneArtifactRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/scene-artifacts/SceneArtifactRepository';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import TrajectoryDumpStorageService from '@modules/trajectory/infrastructure/services/trajectory/TrajectoryDumpStorageService';
import { createHash } from 'node:crypto';

import type {
    CreateDislocationStyledModelResult,
    DislocationStyleSpec,
    DislocationStyleStreamResponse,
    IDislocationStyleService
} from '@modules/trajectory/domain/port/dislocation-style/IDislocationStyleService';

const buildClusterRequiredError = (): ApplicationError => {
    return new ApplicationError(
        ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND,
        'This operation requires a team cluster. No local native modules available.',
        501
    );
};

// Key-sorted stringify so equal styles always map to the same object name —
// the styled GLB cache in MinIO falls out of the path being deterministic.
const stableStringify = (value: unknown): string => {
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(',')}]`;
    }
    if (typeof value === 'object' && value !== null) {
        const entries = Object.entries(value as Record<string, unknown>)
            .filter(([, entryValue]) => entryValue !== undefined)
            .sort(([left], [right]) => left.localeCompare(right));
        return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(',')}}`;
    }
    return JSON.stringify(value);
};

export const hashDislocationStyle = (style: DislocationStyleSpec): string => {
    return createHash('sha1').update(stableStringify(style)).digest('hex').slice(0, 16);
};

@Singleton(TRAJECTORY_TOKENS.DislocationStyleService)
export default class DislocationStyleService implements IDislocationStyleService {
    constructor(

        private readonly dumpStorage: TrajectoryDumpStorageService,

        private readonly sceneArtifactRepository: SceneArtifactRepository,

        private readonly trajectoryRepository: TrajectoryRepository,

        private readonly analysisRepository: AnalysisRepository,

        private readonly teamClusterSelectionService: TeamClusterSelectionService,

        private readonly trajectoryNativeDaemonService: TrajectoryNativeDaemonService
    ) { }

    async createStyledModel(
        trajectoryId: string,
        timestep: string | number,
        analysisId: string,
        exposureId: string,
        style: DislocationStyleSpec
    ): Promise<CreateDislocationStyledModelResult> {
        const objectName = buildDislocationStyleObjectName(
            trajectoryId,
            analysisId,
            timestep,
            exposureId,
            hashDislocationStyle(style)
        );
        const {
            computeClusterId,
            storageClusterId
        } = await resolveSceneArtifactExecutionContext({
            trajectoryId: String(trajectoryId),
            timestep: String(timestep),
            analysisId,
            analysisRepository: this.analysisRepository,
            trajectoryRepository: this.trajectoryRepository,
            teamClusterSelectionService: this.teamClusterSelectionService,
            dumpStorage: this.dumpStorage,
            buildClusterRequiredError
        });

        const response = await this.trajectoryNativeDaemonService.exportDislocationModel({
            teamClusterId: computeClusterId,
            trajectoryId: String(trajectoryId),
            timestep: Number(timestep),
            analysisId: String(analysisId),
            exposureId: String(exposureId),
            objectKey: objectName,
            ownerClusterId: storageClusterId,
            style
        });

        const colorMode = style.colorMode ?? 'family';
        const lineWidthLabel = style.lineWidth !== undefined ? ` · w=${style.lineWidth}` : '';
        await recordSceneArtifact(this.sceneArtifactRepository, {
            trajectory: String(trajectoryId),
            storageClusterId,
            analysis: String(analysisId),
            sourceType: SceneArtifactSourceType.DislocationStyle,
            timestep: Number(timestep),
            objectName,
            params: {
                exposureId: String(exposureId),
                style: style as Record<string, unknown>
            },
            displayName: `DXA · ${colorMode}${lineWidthLabel} · t=${timestep}`,
            metadata: {
                analysisId: String(analysisId),
                exposureId: String(exposureId),
                segmentsRendered: response.segmentsRendered,
                segmentsTotal: response.segmentsTotal,
                familyCounts: response.familyCounts
            }
        });

        return {
            objectName,
            segmentsRendered: response.segmentsRendered,
            segmentsTotal: response.segmentsTotal,
            familyCounts: response.familyCounts
        };
    }

    async getModelStreamResponse(
        trajectoryId: string,
        timestep: string | number,
        analysisId: string,
        exposureId: string,
        style: DislocationStyleSpec
    ): Promise<DislocationStyleStreamResponse> {
        const trajectory = await this.trajectoryRepository.findById(String(trajectoryId));
        const storageClusterId = trajectory
            ? resolveTrajectoryStorageClusterId(trajectory.props)
            : undefined;

        if (!storageClusterId) {
            throw buildClusterRequiredError();
        }

        const objectName = buildDislocationStyleObjectName(
            trajectoryId,
            analysisId,
            timestep,
            exposureId,
            hashDislocationStyle(style)
        );

        return this.trajectoryNativeDaemonService.getObjectStreamResponse(
            storageClusterId,
            TEAM_CLUSTER_BUCKETS.MODELS,
            objectName
        );
    }
};
