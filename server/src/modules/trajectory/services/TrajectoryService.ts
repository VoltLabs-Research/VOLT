import { ErrorCodes } from '@core/constants/error-codes';
import colorCodingService from '@modules/trajectory/services/color-coding/ColorCodingService';
import lineStyleService from '@modules/trajectory/services/line-style/LineStyleService';
import particleFilterService, { buildParticleFilterRequest } from '@modules/trajectory/services/particle-filter/ParticleFilterService';
import atomPropertiesService from '@modules/trajectory/services/trajectory/AtomPropertiesService';
import sceneArtifactQueryService from '@modules/trajectory/services/trajectory/SceneArtifactQueryService';
import trajectoryCatalogService from '@modules/trajectory/services/trajectory/TrajectoryCatalogService';
import trajectoryDownloadService from '@modules/trajectory/services/trajectory/TrajectoryDownloadService';
import trajectoryUploadSessionService from '@modules/trajectory/services/trajectory/TrajectoryUploadSessionService';
import teamMetricsQueryService from '@modules/trajectory/services/trajectory/TeamMetricsQueryService';
import { cloneTrajectory } from '@modules/trajectory/services/trajectory/TrajectoryCloneService';
import { getTrajectoryAtoms } from '@modules/trajectory/services/trajectory/TrajectoryAtomsService';
import { getTrajectoryPreview } from '@modules/trajectory/services/trajectory/TrajectoryPreviewService';

import ApplicationError from '@shared/application/errors/ApplicationError';

import type { TeamMetricsSnapshot } from '@modules/trajectory/services/trajectory/TeamMetricsQueryService';
import type {
    TrajectoryFolderQuery,
    TrajectoryFolderView
} from '@modules/trajectory/services/trajectory/TrajectoryCatalogService';
import type { CreateLineStyledModelResult, LineStyleSpec } from '@modules/trajectory/services/line-style/LineStyleService';
import type { DownloadStreamOutput } from '@shared/contracts/types';
import type { StreamableOutput } from '@shared/contracts/types/StreamableOutput';
import type { PaginatedResult } from '@shared/domain/port/persistence';
import type {
    ApplyParticleFilterActionInput,
    ApplyParticleFilterActionOutput,
    CloneTrajectoryInput,
    CloneTrajectoryOutput,
    CreateColoredModelInput,
    CreateLineStyledModelInput,
    CreateTrajectoryUploadSessionInput,
    CreateTrajectoryUploadSessionOutput,
    DownloadSampleSimulationsOutput,
    DownloadTrajectoryAnalysesInput,
    DownloadTrajectoryInput,
    GetAtomsColumnarInput,
    GetAtomsColumnarOutput,
    GetColorCodingPropertiesOutput,
    GetColorCodingStatsInput,
    GetColorCodingStatsOutput,
    GetFilteredModelStreamInput,
    GetLineEntityPropertiesInput,
    GetLineEntityPropertiesOutput,
    GetLineStyledModelStreamInput,
    GetParticleFilterPropertiesOutput,
    GetParticleFilterUniqueValuesInput,
    GetParticleFilterUniqueValuesOutput,
    GetTrajectoriesByTeamIdInput,
    ListPublicTeamTrajectoriesInput,
    ListPublicTeamTrajectoriesOutput,
    ListTeamSceneArtifactsInput,
    ListTrajectorySceneArtifactsInput,
    LineExposureScope,
    MoveTrajectoryInput,
    PreviewParticleFilterInput,
    PreviewParticleFilterOutput,
    TrajectoryExposureScope,
    TrajectoryPreviewResult,
    TrajectoryRecord,
    TrajectoryUploadSessionRequest,
    UpdateTrajectoryByIdInput
} from '@modules/trajectory/services/TrajectoryServiceTypes';

/** `style` travels as a JSON-encoded query parameter, so it needs decoding. */
const parseLineStyle = (style: string | undefined): LineStyleSpec => (
    style ? JSON.parse(style) as LineStyleSpec : {}
);

/**
 * `timestep` reaches these endpoints as a query parameter, so the key can simply
 * be absent. Without this the missing value travels all the way to the daemon and
 * surfaces as an unhandled `BigInt` conversion instead of a 400.
 */
const requireTimestep = (timestep: string): string => {
    const value = String(timestep ?? '').trim();
    if (!value || !Number.isFinite(Number(value))) {
        throw ApplicationError.badRequest(
            ErrorCodes.TRAJECTORY_INVALID_TIMESTEP,
            'The "timestep" query parameter is required and must be numeric.'
        );
    }

    return value;
};

/**
 * Public surface of the trajectory module. Everything here delegates to the
 * service that owns the concern; the facade exists so controllers, AI tools and
 * the public canvas share one entry point.
 */
export default class TrajectoryService {
    createUploadSession(input: CreateTrajectoryUploadSessionInput): Promise<CreateTrajectoryUploadSessionOutput> {
        return trajectoryUploadSessionService.create(input);
    }

    commitUploadSession(input: TrajectoryUploadSessionRequest): Promise<{ trajectoryId: string }> {
        return trajectoryUploadSessionService.commit(input);
    }

    cancelUploadSession(input: TrajectoryUploadSessionRequest): Promise<void> {
        return trajectoryUploadSessionService.cancel(input);
    }

    getById(input: { trajectoryId: string }): Promise<TrajectoryRecord> {
        return trajectoryCatalogService.getById(input.trajectoryId);
    }

    getByTeamId(input: GetTrajectoriesByTeamIdInput): Promise<PaginatedResult<TrajectoryRecord>> {
        return trajectoryCatalogService.getByTeamId(input);
    }

    listPublicTeamTrajectories(input: ListPublicTeamTrajectoriesInput): Promise<ListPublicTeamTrajectoriesOutput> {
        return trajectoryCatalogService.listPublicByTeamId(input);
    }

    updateById(input: UpdateTrajectoryByIdInput): Promise<TrajectoryRecord> {
        return trajectoryCatalogService.updateById(input);
    }

    move(input: MoveTrajectoryInput): Promise<null> {
        return trajectoryCatalogService.move(input);
    }

    deleteById(input: { trajectoryId: string; teamId?: string; userId?: string }): Promise<{ success: boolean }> {
        return trajectoryCatalogService.deleteById(input);
    }

    listFolders(teamId: string, query: TrajectoryFolderQuery): Promise<PaginatedResult<TrajectoryFolderView>> {
        return trajectoryCatalogService.listFolders(teamId, query);
    }

    getFolder(teamId: string, folderId: string): Promise<TrajectoryFolderView> {
        return trajectoryCatalogService.getFolder(teamId, folderId);
    }

    createFolder(
        teamId: string,
        userId: string,
        input: { title: string; parentId?: string | null }
    ): Promise<TrajectoryFolderView> {
        return trajectoryCatalogService.createFolder(teamId, userId, input);
    }

    updateFolder(teamId: string, folderId: string, input: { title: string }): Promise<TrajectoryFolderView> {
        return trajectoryCatalogService.updateFolder(teamId, folderId, input.title);
    }

    deleteFolder(teamId: string, folderId: string): Promise<null> {
        return trajectoryCatalogService.deleteFolder(teamId, folderId);
    }

    getTeamMetrics(input: { teamId: string }): Promise<TeamMetricsSnapshot> {
        return teamMetricsQueryService.getTeamMetrics(input.teamId);
    }

    getPreview(input: { trajectoryId: string }): Promise<TrajectoryPreviewResult> {
        return getTrajectoryPreview(input.trajectoryId);
    }

    cloneTrajectory(input: CloneTrajectoryInput): Promise<CloneTrajectoryOutput> {
        return cloneTrajectory(input);
    }

    listSamples(): Promise<string[]> {
        return trajectoryDownloadService.listSamples();
    }

    downloadSamples(input: { filename?: string }): Promise<DownloadSampleSimulationsOutput> {
        return trajectoryDownloadService.downloadSamples(input);
    }

    downloadTrajectory(input: DownloadTrajectoryInput): Promise<DownloadStreamOutput> {
        return trajectoryDownloadService.downloadTrajectory(input);
    }

    downloadTrajectoryAnalyses(input: DownloadTrajectoryAnalysesInput): Promise<DownloadStreamOutput> {
        return trajectoryDownloadService.downloadTrajectoryAnalyses(input);
    }

    getAtoms(input: GetAtomsColumnarInput): Promise<GetAtomsColumnarOutput> {
        return getTrajectoryAtoms(input);
    }

    getSceneArtifacts(input: ListTrajectorySceneArtifactsInput): Promise<PaginatedResult<unknown>> {
        return sceneArtifactQueryService.listByTrajectory(input);
    }

    listTeamSceneArtifacts(input: ListTeamSceneArtifactsInput): Promise<PaginatedResult<unknown>> {
        return sceneArtifactQueryService.listByTeam(input);
    }

    getColorCodingProperties(input: TrajectoryExposureScope): Promise<GetColorCodingPropertiesOutput> {
        return colorCodingService.getProperties(input.trajectoryId, requireTimestep(input.timestep), input.analysisId);
    }

    getColorCodingStats(input: GetColorCodingStatsInput): Promise<GetColorCodingStatsOutput> {
        return colorCodingService.getStats(
            input.trajectoryId,
            requireTimestep(input.timestep),
            input.property,
            input.type,
            input.analysisId,
            input.exposureId
        );
    }

    async createColoredModel(input: CreateColoredModelInput): Promise<null> {
        await colorCodingService.createColoredModel(
            input.trajectoryId,
            input.timestep,
            input.property,
            input.startValue,
            input.endValue,
            input.gradient,
            input.analysisId,
            input.exposureId
        );
        return null;
    }

    getColoredModelStream(input: CreateColoredModelInput): Promise<StreamableOutput> {
        return colorCodingService.getModelStreamResponse(
            input.trajectoryId,
            input.timestep,
            input.property,
            input.startValue,
            input.endValue,
            input.gradient,
            input.analysisId,
            input.exposureId
        );
    }

    getParticleFilterProperties(input: TrajectoryExposureScope): Promise<GetParticleFilterPropertiesOutput> {
        return particleFilterService.getProperties(input.trajectoryId, requireTimestep(input.timestep), input.analysisId);
    }

    async getParticleFilterUniqueValues(
        input: GetParticleFilterUniqueValuesInput
    ): Promise<GetParticleFilterUniqueValuesOutput> {
        const values = await particleFilterService.getUniqueValues(
            input.trajectoryId,
            requireTimestep(input.timestep),
            input.property,
            input.maxValues,
            input.analysisId,
            input.exposureId
        );
        return { values };
    }

    previewParticleFilter(input: PreviewParticleFilterInput): Promise<PreviewParticleFilterOutput> {
        return particleFilterService.preview(
            input.trajectoryId,
            requireTimestep(input.timestep),
            buildParticleFilterRequest(input),
            input.analysisId
        );
    }

    applyParticleFilterAction(input: ApplyParticleFilterActionInput): Promise<ApplyParticleFilterActionOutput> {
        return particleFilterService.applyAction(
            input.trajectoryId,
            requireTimestep(input.timestep),
            input.action,
            buildParticleFilterRequest(input),
            input.analysisId
        );
    }

    getFilteredModelStream(input: GetFilteredModelStreamInput): Promise<StreamableOutput> {
        return particleFilterService.getModelStreamResponse(
            input.trajectoryId,
            requireTimestep(input.timestep),
            buildParticleFilterRequest(input),
            input.action,
            input.analysisId
        );
    }

    createLineStyledModel(input: CreateLineStyledModelInput): Promise<CreateLineStyledModelResult> {
        return lineStyleService.createStyledModel(
            input.trajectoryId,
            requireTimestep(input.timestep),
            input.analysisId,
            input.exposureId,
            input.style ?? {}
        );
    }

    getLineStyledModelStream(input: GetLineStyledModelStreamInput): Promise<StreamableOutput> {
        return lineStyleService.getModelStreamResponse(
            input.trajectoryId,
            requireTimestep(input.timestep),
            input.analysisId,
            input.exposureId,
            parseLineStyle(input.style)
        );
    }

    getLineModelRangesStream(input: GetLineStyledModelStreamInput): Promise<StreamableOutput> {
        return lineStyleService.getRangesStreamResponse(
            input.trajectoryId,
            requireTimestep(input.timestep),
            input.analysisId,
            input.exposureId,
            input.style ? parseLineStyle(input.style) : undefined
        );
    }

    getOctreeMetadataStream(input: LineExposureScope): Promise<StreamableOutput> {
        return lineStyleService.getOctreeMetadataStreamResponse(
            input.trajectoryId,
            requireTimestep(input.timestep),
            input.analysisId,
            input.exposureId
        );
    }

    /**
     * Per-entity plugin properties for the line inspector. The daemon indexes by
     * numeric entity id, so the path segment has to become a number.
     */
    async getLineEntityProperties(input: GetLineEntityPropertiesInput): Promise<GetLineEntityPropertiesOutput> {
        const entityId = Number(input.entityId);
        if (!Number.isInteger(entityId) || entityId < 0) {
            throw ApplicationError.badRequest(ErrorCodes.LINE_ENTITY_ID_INVALID, 'The entity id must be a non-negative integer.');
        }

        const index = await atomPropertiesService.buildPluginIndexForAtomIds(
            input.trajectoryId,
            input.analysisId,
            input.exposureId,
            requireTimestep(input.timestep),
            new Set([entityId])
        );

        const properties = index?.get(entityId);
        if (!properties) {
            throw ApplicationError.notFound(
                ErrorCodes.LINE_ENTITY_NOT_FOUND,
                `No entity ${entityId} found for exposure "${input.exposureId}" at timestep ${input.timestep}`
            );
        }

        return {
            entityId,
            properties
        };
    }
}
