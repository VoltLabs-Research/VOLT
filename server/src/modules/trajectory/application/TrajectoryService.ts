import CancelTrajectoryUploadSessionUseCase from '@modules/trajectory/application/use-cases/trajectory/CancelTrajectoryUploadSessionUseCase';
import CloneTrajectoryUseCase from '@modules/trajectory/application/use-cases/trajectory/CloneTrajectoryUseCase';
import CommitTrajectoryUploadSessionUseCase from '@modules/trajectory/application/use-cases/trajectory/CommitTrajectoryUploadSessionUseCase';
import CreateTrajectoryUploadSessionUseCase from '@modules/trajectory/application/use-cases/trajectory/CreateTrajectoryUploadSessionUseCase';
import DeleteTrajectoryByIdUseCase from '@modules/trajectory/application/use-cases/trajectory/DeleteTrajectoryByIdUseCase';
import DownloadSampleSimulationsUseCase from '@modules/trajectory/application/use-cases/trajectory/DownloadSampleSimulationsUseCase';
import DownloadTrajectoryAnalysesUseCase from '@modules/trajectory/application/use-cases/trajectory/DownloadTrajectoryAnalysesUseCase';
import DownloadTrajectoryUseCase from '@modules/trajectory/application/use-cases/trajectory/DownloadTrajectoryUseCase';
import GetTeamMetricsUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTeamMetricsUseCase';
import GetTrajectoriesByTeamIdUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTrajectoriesByTeamIdUseCase';
import GetTrajectoryByIdUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTrajectoryByIdUseCase';
import GetTrajectoryPreviewUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTrajectoryPreviewUseCase';
import ListPublicTeamTrajectoriesUseCase from '@modules/trajectory/application/use-cases/trajectory/ListPublicTeamTrajectoriesUseCase';
import ListSampleSimulationsUseCase from '@modules/trajectory/application/use-cases/trajectory/ListSampleSimulationsUseCase';
import MoveTrajectoryUseCase from '@modules/trajectory/application/use-cases/trajectory/MoveTrajectoryUseCase';
import UpdateTrajectoryByIdUseCase from '@modules/trajectory/application/use-cases/trajectory/UpdateTrajectoryByIdUseCase';
import { GetAtomsUseCase } from '@modules/trajectory/application/use-cases/trajectory/GetAtomsUseCase';
import { ListTeamSceneArtifactsUseCase } from '@modules/trajectory/application/use-cases/scene-artifacts/ListTeamSceneArtifactsUseCase';
import { ListTrajectorySceneArtifactsUseCase } from '@modules/trajectory/application/use-cases/scene-artifacts/ListTrajectorySceneArtifactsUseCase';
import { CreateColoredModelUseCase } from '@modules/trajectory/application/use-cases/color-coding/CreateColoredModelUseCase';
import { GetColorCodingPropertiesUseCase } from '@modules/trajectory/application/use-cases/color-coding/GetColorCodingPropertiesUseCase';
import { GetColorCodingStatsUseCase } from '@modules/trajectory/application/use-cases/color-coding/GetColorCodingStatsUseCase';
import { GetColoredModelStreamUseCase } from '@modules/trajectory/application/use-cases/color-coding/GetColoredModelStreamUseCase';
import { ApplyParticleFilterActionUseCase } from '@modules/trajectory/application/use-cases/particle-filter/ApplyParticleFilterActionUseCase';
import { GetFilteredModelStreamUseCase } from '@modules/trajectory/application/use-cases/particle-filter/GetFilteredModelStreamUseCase';
import { GetParticleFilterPropertiesUseCase } from '@modules/trajectory/application/use-cases/particle-filter/GetParticleFilterPropertiesUseCase';
import { GetParticleFilterUniqueValuesUseCase } from '@modules/trajectory/application/use-cases/particle-filter/GetParticleFilterUniqueValuesUseCase';
import { PreviewParticleFilterUseCase } from '@modules/trajectory/application/use-cases/particle-filter/PreviewParticleFilterUseCase';
import { CreateLineStyledModelUseCase } from '@modules/trajectory/application/use-cases/line-style/CreateLineStyledModelUseCase';
import { GetLineEntityPropertiesUseCase } from '@modules/trajectory/application/use-cases/line-style/GetLineEntityPropertiesUseCase';
import { GetLineModelRangesStreamUseCase } from '@modules/trajectory/application/use-cases/line-style/GetLineModelRangesStreamUseCase';
import { GetLineStyledModelStreamUseCase } from '@modules/trajectory/application/use-cases/line-style/GetLineStyledModelStreamUseCase';
import { GetOctreeMetadataStreamUseCase } from '@modules/trajectory/application/use-cases/lod/GetOctreeMetadataStreamUseCase';
import { GetPublicCanvasAnalysisFrameLogUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasAnalysisFrameLogUseCase';
import { GetPublicCanvasAtomsUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasAtomsUseCase';
import { GetPublicCanvasBootstrapUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasBootstrapUseCase';
import { GetPublicCanvasColorCodingPropertiesUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasColorCodingPropertiesUseCase';
import { GetPublicCanvasColorCodingStatsUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasColorCodingStatsUseCase';
import { GetPublicCanvasColoredModelStreamUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasColoredModelStreamUseCase';
import { GetPublicCanvasDumpUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasDumpUseCase';
import { GetPublicCanvasFilteredModelStreamUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasFilteredModelStreamUseCase';
import { GetPublicCanvasGLBUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasGLBUseCase';
import { GetPublicCanvasParticleFilterPreviewUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasParticleFilterPreviewUseCase';
import { GetPublicCanvasParticleFilterPropertiesUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasParticleFilterPropertiesUseCase';
import { GetPublicCanvasParticleFilterUniqueValuesUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasParticleFilterUniqueValuesUseCase';
import { GetPublicCanvasPluginExposureGLBUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasPluginExposureGLBUseCase';
import { GetPublicCanvasPluginListingUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasPluginListingUseCase';
import { GetPublicCanvasPluginUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasPluginUseCase';
import { GetPublicCanvasPreviewUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasPreviewUseCase';
import { GetPublicCanvasRasterFrameUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasRasterFrameUseCase';
import { GetPublicCanvasRasterMetadataUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasRasterMetadataUseCase';
import { GetPublicCanvasSimulationCellUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasSimulationCellUseCase';
import { GetPublicCanvasSubListingUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasSubListingUseCase';
import { GetPublicCanvasTrajectoryUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasTrajectoryUseCase';
import { ListPublicCanvasAnalysesUseCase } from '@modules/trajectory/application/use-cases/canvas/ListPublicCanvasAnalysesUseCase';
import { ListPublicCanvasSceneArtifactsUseCase } from '@modules/trajectory/application/use-cases/canvas/ListPublicCanvasSceneArtifactsUseCase';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

import type { IUseCase, UseCaseInput, UseCaseOutput } from '@shared/application/IUseCase';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';

/**
 * The single HTTP-facing application service for the trajectory module. Each
 * method is a thin delegator to a retained use case: it runs the use case and
 * unwraps the `Result` onto the thrown-error channel (`ApplicationError`s
 * propagate to `httpErrorMiddleware` via Express 5 async forwarding), mirroring
 * the auth/latex/raster modules.
 *
 * No heavy domain logic lives here — the native daemon, trajectory
 * reader/parser, particle-filter, LOD, color-coding, canvas realtime/collab and
 * scene-artifact services all remain in their own classes and are only reached
 * transitively through the use cases delegated to below. Every use case is
 * kept (many are also consumed by AI tools, event handlers, socket modules and
 * cross-module contract ports), so this service adds a delegation surface
 * without moving or removing any behaviour.
 */
@Singleton(TRAJECTORY_TOKENS.TrajectoryService)
export default class TrajectoryService {
    constructor(
        @inject(CreateTrajectoryUploadSessionUseCase) private readonly createTrajectoryUploadSessionUseCase: CreateTrajectoryUploadSessionUseCase,
        @inject(CommitTrajectoryUploadSessionUseCase) private readonly commitTrajectoryUploadSessionUseCase: CommitTrajectoryUploadSessionUseCase,
        @inject(CancelTrajectoryUploadSessionUseCase) private readonly cancelTrajectoryUploadSessionUseCase: CancelTrajectoryUploadSessionUseCase,
        @inject(DeleteTrajectoryByIdUseCase) private readonly deleteTrajectoryByIdUseCase: DeleteTrajectoryByIdUseCase,
        @inject(GetTeamMetricsUseCase) private readonly getTeamMetricsUseCase: GetTeamMetricsUseCase,
        @inject(GetTrajectoriesByTeamIdUseCase) private readonly getTrajectoriesByTeamIdUseCase: GetTrajectoriesByTeamIdUseCase,
        @inject(GetTrajectoryByIdUseCase) private readonly getTrajectoryByIdUseCase: GetTrajectoryByIdUseCase,
        @inject(UpdateTrajectoryByIdUseCase) private readonly updateTrajectoryByIdUseCase: UpdateTrajectoryByIdUseCase,
        @inject(MoveTrajectoryUseCase) private readonly moveTrajectoryUseCase: MoveTrajectoryUseCase,
        @inject(ListSampleSimulationsUseCase) private readonly listSampleSimulationsUseCase: ListSampleSimulationsUseCase,
        @inject(CloneTrajectoryUseCase) private readonly cloneTrajectoryUseCase: CloneTrajectoryUseCase,
        @inject(GetTrajectoryPreviewUseCase) private readonly getTrajectoryPreviewUseCase: GetTrajectoryPreviewUseCase,
        @inject(DownloadTrajectoryUseCase) private readonly downloadTrajectoryUseCase: DownloadTrajectoryUseCase,
        @inject(DownloadTrajectoryAnalysesUseCase) private readonly downloadTrajectoryAnalysesUseCase: DownloadTrajectoryAnalysesUseCase,
        @inject(DownloadSampleSimulationsUseCase) private readonly downloadSampleSimulationsUseCase: DownloadSampleSimulationsUseCase,
        @inject(GetAtomsUseCase) private readonly getAtomsUseCase: GetAtomsUseCase,
        @inject(ListTrajectorySceneArtifactsUseCase) private readonly listTrajectorySceneArtifactsUseCase: ListTrajectorySceneArtifactsUseCase,
        @inject(ListTeamSceneArtifactsUseCase) private readonly listTeamSceneArtifactsUseCase: ListTeamSceneArtifactsUseCase,
        @inject(GetColorCodingPropertiesUseCase) private readonly getColorCodingPropertiesUseCase: GetColorCodingPropertiesUseCase,
        @inject(GetColorCodingStatsUseCase) private readonly getColorCodingStatsUseCase: GetColorCodingStatsUseCase,
        @inject(CreateColoredModelUseCase) private readonly createColoredModelUseCase: CreateColoredModelUseCase,
        @inject(GetColoredModelStreamUseCase) private readonly getColoredModelStreamUseCase: GetColoredModelStreamUseCase,
        @inject(GetParticleFilterPropertiesUseCase) private readonly getParticleFilterPropertiesUseCase: GetParticleFilterPropertiesUseCase,
        @inject(PreviewParticleFilterUseCase) private readonly previewParticleFilterUseCase: PreviewParticleFilterUseCase,
        @inject(ApplyParticleFilterActionUseCase) private readonly applyParticleFilterActionUseCase: ApplyParticleFilterActionUseCase,
        @inject(GetFilteredModelStreamUseCase) private readonly getFilteredModelStreamUseCase: GetFilteredModelStreamUseCase,
        @inject(GetParticleFilterUniqueValuesUseCase) private readonly getParticleFilterUniqueValuesUseCase: GetParticleFilterUniqueValuesUseCase,
        @inject(CreateLineStyledModelUseCase) private readonly createLineStyledModelUseCase: CreateLineStyledModelUseCase,
        @inject(GetLineStyledModelStreamUseCase) private readonly getLineStyledModelStreamUseCase: GetLineStyledModelStreamUseCase,
        @inject(GetLineModelRangesStreamUseCase) private readonly getLineModelRangesStreamUseCase: GetLineModelRangesStreamUseCase,
        @inject(GetLineEntityPropertiesUseCase) private readonly getLineEntityPropertiesUseCase: GetLineEntityPropertiesUseCase,
        @inject(GetOctreeMetadataStreamUseCase) private readonly getOctreeMetadataStreamUseCase: GetOctreeMetadataStreamUseCase,
        @inject(ListPublicTeamTrajectoriesUseCase) private readonly listPublicTeamTrajectoriesUseCase: ListPublicTeamTrajectoriesUseCase,
        @inject(GetPublicCanvasBootstrapUseCase) private readonly getPublicCanvasBootstrapUseCase: GetPublicCanvasBootstrapUseCase,
        @inject(GetPublicCanvasTrajectoryUseCase) private readonly getPublicCanvasTrajectoryUseCase: GetPublicCanvasTrajectoryUseCase,
        @inject(GetPublicCanvasPreviewUseCase) private readonly getPublicCanvasPreviewUseCase: GetPublicCanvasPreviewUseCase,
        @inject(GetPublicCanvasRasterFrameUseCase) private readonly getPublicCanvasRasterFrameUseCase: GetPublicCanvasRasterFrameUseCase,
        @inject(GetPublicCanvasDumpUseCase) private readonly getPublicCanvasDumpUseCase: GetPublicCanvasDumpUseCase,
        @inject(GetPublicCanvasGLBUseCase) private readonly getPublicCanvasGLBUseCase: GetPublicCanvasGLBUseCase,
        @inject(ListPublicCanvasAnalysesUseCase) private readonly listPublicCanvasAnalysesUseCase: ListPublicCanvasAnalysesUseCase,
        @inject(GetPublicCanvasSimulationCellUseCase) private readonly getPublicCanvasSimulationCellUseCase: GetPublicCanvasSimulationCellUseCase,
        @inject(ListPublicCanvasSceneArtifactsUseCase) private readonly listPublicCanvasSceneArtifactsUseCase: ListPublicCanvasSceneArtifactsUseCase,
        @inject(GetPublicCanvasColorCodingPropertiesUseCase) private readonly getPublicCanvasColorCodingPropertiesUseCase: GetPublicCanvasColorCodingPropertiesUseCase,
        @inject(GetPublicCanvasColorCodingStatsUseCase) private readonly getPublicCanvasColorCodingStatsUseCase: GetPublicCanvasColorCodingStatsUseCase,
        @inject(GetPublicCanvasColoredModelStreamUseCase) private readonly getPublicCanvasColoredModelStreamUseCase: GetPublicCanvasColoredModelStreamUseCase,
        @inject(GetPublicCanvasParticleFilterPropertiesUseCase) private readonly getPublicCanvasParticleFilterPropertiesUseCase: GetPublicCanvasParticleFilterPropertiesUseCase,
        @inject(GetPublicCanvasParticleFilterUniqueValuesUseCase) private readonly getPublicCanvasParticleFilterUniqueValuesUseCase: GetPublicCanvasParticleFilterUniqueValuesUseCase,
        @inject(GetPublicCanvasParticleFilterPreviewUseCase) private readonly getPublicCanvasParticleFilterPreviewUseCase: GetPublicCanvasParticleFilterPreviewUseCase,
        @inject(GetPublicCanvasFilteredModelStreamUseCase) private readonly getPublicCanvasFilteredModelStreamUseCase: GetPublicCanvasFilteredModelStreamUseCase,
        @inject(GetPublicCanvasPluginUseCase) private readonly getPublicCanvasPluginUseCase: GetPublicCanvasPluginUseCase,
        @inject(GetPublicCanvasPluginListingUseCase) private readonly getPublicCanvasPluginListingUseCase: GetPublicCanvasPluginListingUseCase,
        @inject(GetPublicCanvasSubListingUseCase) private readonly getPublicCanvasSubListingUseCase: GetPublicCanvasSubListingUseCase,
        @inject(GetPublicCanvasPluginExposureGLBUseCase) private readonly getPublicCanvasPluginExposureGLBUseCase: GetPublicCanvasPluginExposureGLBUseCase,
        @inject(GetPublicCanvasAnalysisFrameLogUseCase) private readonly getPublicCanvasAnalysisFrameLogUseCase: GetPublicCanvasAnalysisFrameLogUseCase,
        @inject(GetPublicCanvasRasterMetadataUseCase) private readonly getPublicCanvasRasterMetadataUseCase: GetPublicCanvasRasterMetadataUseCase,
        @inject(GetPublicCanvasAtomsUseCase) private readonly getPublicCanvasAtomsUseCase: GetPublicCanvasAtomsUseCase
    ) {}

    /**
     * Runs a use case and unwraps the Result: success returns the value, failure
     * throws the error so Express 5 forwards it to `httpErrorMiddleware`.
     */
    private async run<TInput, TOutput>(
        useCase: IUseCase<TInput, TOutput, unknown>,
        input: TInput
    ): Promise<TOutput> {
        const result = await useCase.execute(input);

        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }

    // --- Trajectory ---

    createUploadSession(input: UseCaseInput<CreateTrajectoryUploadSessionUseCase>) {
        return this.run(this.createTrajectoryUploadSessionUseCase, input);
    }

    commitUploadSession(input: UseCaseInput<CommitTrajectoryUploadSessionUseCase>) {
        return this.run(this.commitTrajectoryUploadSessionUseCase, input);
    }

    cancelUploadSession(input: UseCaseInput<CancelTrajectoryUploadSessionUseCase>) {
        return this.run(this.cancelTrajectoryUploadSessionUseCase, input);
    }

    deleteById(input: UseCaseInput<DeleteTrajectoryByIdUseCase>) {
        return this.run(this.deleteTrajectoryByIdUseCase, input);
    }

    getTeamMetrics(input: UseCaseInput<GetTeamMetricsUseCase>) {
        return this.run(this.getTeamMetricsUseCase, input);
    }

    getByTeamId(input: UseCaseInput<GetTrajectoriesByTeamIdUseCase>) {
        return this.run(this.getTrajectoriesByTeamIdUseCase, input);
    }

    getById(input: UseCaseInput<GetTrajectoryByIdUseCase>) {
        return this.run(this.getTrajectoryByIdUseCase, input);
    }

    updateById(input: UseCaseInput<UpdateTrajectoryByIdUseCase>) {
        return this.run(this.updateTrajectoryByIdUseCase, input);
    }

    move(input: UseCaseInput<MoveTrajectoryUseCase>) {
        return this.run(this.moveTrajectoryUseCase, input);
    }

    listSamples(): Promise<UseCaseOutput<ListSampleSimulationsUseCase>> {
        return this.run(this.listSampleSimulationsUseCase, undefined);
    }

    cloneTrajectory(input: UseCaseInput<CloneTrajectoryUseCase>) {
        return this.run(this.cloneTrajectoryUseCase, input);
    }

    getPreview(input: UseCaseInput<GetTrajectoryPreviewUseCase>) {
        return this.run(this.getTrajectoryPreviewUseCase, input);
    }

    downloadTrajectory(input: UseCaseInput<DownloadTrajectoryUseCase>) {
        return this.run(this.downloadTrajectoryUseCase, input);
    }

    downloadTrajectoryAnalyses(input: UseCaseInput<DownloadTrajectoryAnalysesUseCase>) {
        return this.run(this.downloadTrajectoryAnalysesUseCase, input);
    }

    downloadSamples(input: UseCaseInput<DownloadSampleSimulationsUseCase>) {
        return this.run(this.downloadSampleSimulationsUseCase, input);
    }

    getAtoms(input: UseCaseInput<GetAtomsUseCase>) {
        return this.run(this.getAtomsUseCase, input);
    }

    // --- Scene artifacts ---

    getSceneArtifacts(input: UseCaseInput<ListTrajectorySceneArtifactsUseCase>) {
        // The use case's `execute` has an inferred union return type, so the
        // output type param is pinned to its declared `PaginatedResult<unknown>`.
        return this.run<UseCaseInput<ListTrajectorySceneArtifactsUseCase>, PaginatedResult<unknown>>(
            this.listTrajectorySceneArtifactsUseCase,
            input
        );
    }

    listTeamSceneArtifacts(input: UseCaseInput<ListTeamSceneArtifactsUseCase>) {
        return this.run(this.listTeamSceneArtifactsUseCase, input);
    }

    // --- Color coding ---

    getColorCodingProperties(input: UseCaseInput<GetColorCodingPropertiesUseCase>) {
        return this.run(this.getColorCodingPropertiesUseCase, input);
    }

    getColorCodingStats(input: UseCaseInput<GetColorCodingStatsUseCase>) {
        return this.run(this.getColorCodingStatsUseCase, input);
    }

    createColoredModel(input: UseCaseInput<CreateColoredModelUseCase>) {
        return this.run(this.createColoredModelUseCase, input);
    }

    getColoredModelStream(input: UseCaseInput<GetColoredModelStreamUseCase>) {
        return this.run(this.getColoredModelStreamUseCase, input);
    }

    // --- Particle filter ---

    getParticleFilterProperties(input: UseCaseInput<GetParticleFilterPropertiesUseCase>) {
        return this.run(this.getParticleFilterPropertiesUseCase, input);
    }

    previewParticleFilter(input: UseCaseInput<PreviewParticleFilterUseCase>) {
        return this.run(this.previewParticleFilterUseCase, input);
    }

    applyParticleFilterAction(input: UseCaseInput<ApplyParticleFilterActionUseCase>) {
        return this.run(this.applyParticleFilterActionUseCase, input);
    }

    getFilteredModelStream(input: UseCaseInput<GetFilteredModelStreamUseCase>) {
        return this.run(this.getFilteredModelStreamUseCase, input);
    }

    getParticleFilterUniqueValues(input: UseCaseInput<GetParticleFilterUniqueValuesUseCase>) {
        return this.run(this.getParticleFilterUniqueValuesUseCase, input);
    }

    // --- Line style ---

    createLineStyledModel(input: UseCaseInput<CreateLineStyledModelUseCase>) {
        return this.run(this.createLineStyledModelUseCase, input);
    }

    getLineStyledModelStream(input: UseCaseInput<GetLineStyledModelStreamUseCase>) {
        return this.run(this.getLineStyledModelStreamUseCase, input);
    }

    getLineModelRangesStream(input: UseCaseInput<GetLineModelRangesStreamUseCase>) {
        return this.run(this.getLineModelRangesStreamUseCase, input);
    }

    getLineEntityProperties(input: UseCaseInput<GetLineEntityPropertiesUseCase>) {
        return this.run(this.getLineEntityPropertiesUseCase, input);
    }

    // --- LOD ---

    getOctreeMetadataStream(input: UseCaseInput<GetOctreeMetadataStreamUseCase>) {
        return this.run(this.getOctreeMetadataStreamUseCase, input);
    }

    // --- Discover ---

    listPublicTeamTrajectories(input: UseCaseInput<ListPublicTeamTrajectoriesUseCase>) {
        return this.run(this.listPublicTeamTrajectoriesUseCase, input);
    }

    // --- Public canvas ---

    getPublicCanvasBootstrap(input: UseCaseInput<GetPublicCanvasBootstrapUseCase>) {
        return this.run(this.getPublicCanvasBootstrapUseCase, input);
    }

    getPublicCanvasTrajectory(input: UseCaseInput<GetPublicCanvasTrajectoryUseCase>) {
        return this.run(this.getPublicCanvasTrajectoryUseCase, input);
    }

    getPublicCanvasPreview(input: UseCaseInput<GetPublicCanvasPreviewUseCase>) {
        return this.run(this.getPublicCanvasPreviewUseCase, input);
    }

    getPublicCanvasRasterFrame(input: UseCaseInput<GetPublicCanvasRasterFrameUseCase>) {
        return this.run(this.getPublicCanvasRasterFrameUseCase, input);
    }

    getPublicCanvasDump(input: UseCaseInput<GetPublicCanvasDumpUseCase>) {
        return this.run(this.getPublicCanvasDumpUseCase, input);
    }

    getPublicCanvasGLB(input: UseCaseInput<GetPublicCanvasGLBUseCase>) {
        return this.run(this.getPublicCanvasGLBUseCase, input);
    }

    listPublicCanvasAnalyses(input: UseCaseInput<ListPublicCanvasAnalysesUseCase>) {
        return this.run(this.listPublicCanvasAnalysesUseCase, input);
    }

    getPublicCanvasSimulationCell(input: UseCaseInput<GetPublicCanvasSimulationCellUseCase>) {
        return this.run(this.getPublicCanvasSimulationCellUseCase, input);
    }

    listPublicCanvasSceneArtifacts(input: UseCaseInput<ListPublicCanvasSceneArtifactsUseCase>) {
        return this.run(this.listPublicCanvasSceneArtifactsUseCase, input);
    }

    getPublicCanvasColorCodingProperties(input: UseCaseInput<GetPublicCanvasColorCodingPropertiesUseCase>) {
        return this.run(this.getPublicCanvasColorCodingPropertiesUseCase, input);
    }

    getPublicCanvasColorCodingStats(input: UseCaseInput<GetPublicCanvasColorCodingStatsUseCase>) {
        return this.run(this.getPublicCanvasColorCodingStatsUseCase, input);
    }

    getPublicCanvasColoredModelStream(input: UseCaseInput<GetPublicCanvasColoredModelStreamUseCase>) {
        return this.run(this.getPublicCanvasColoredModelStreamUseCase, input);
    }

    getPublicCanvasParticleFilterProperties(input: UseCaseInput<GetPublicCanvasParticleFilterPropertiesUseCase>) {
        return this.run(this.getPublicCanvasParticleFilterPropertiesUseCase, input);
    }

    getPublicCanvasParticleFilterUniqueValues(input: UseCaseInput<GetPublicCanvasParticleFilterUniqueValuesUseCase>) {
        return this.run(this.getPublicCanvasParticleFilterUniqueValuesUseCase, input);
    }

    getPublicCanvasParticleFilterPreview(input: UseCaseInput<GetPublicCanvasParticleFilterPreviewUseCase>) {
        return this.run(this.getPublicCanvasParticleFilterPreviewUseCase, input);
    }

    getPublicCanvasFilteredModelStream(input: UseCaseInput<GetPublicCanvasFilteredModelStreamUseCase>) {
        return this.run(this.getPublicCanvasFilteredModelStreamUseCase, input);
    }

    getPublicCanvasPlugin(input: UseCaseInput<GetPublicCanvasPluginUseCase>) {
        return this.run(this.getPublicCanvasPluginUseCase, input);
    }

    getPublicCanvasPluginListing(input: UseCaseInput<GetPublicCanvasPluginListingUseCase>) {
        return this.run(this.getPublicCanvasPluginListingUseCase, input);
    }

    getPublicCanvasSubListing(input: UseCaseInput<GetPublicCanvasSubListingUseCase>) {
        return this.run(this.getPublicCanvasSubListingUseCase, input);
    }

    getPublicCanvasPluginExposureGLB(input: UseCaseInput<GetPublicCanvasPluginExposureGLBUseCase>) {
        return this.run(this.getPublicCanvasPluginExposureGLBUseCase, input);
    }

    getPublicCanvasAnalysisFrameLog(input: UseCaseInput<GetPublicCanvasAnalysisFrameLogUseCase>) {
        return this.run(this.getPublicCanvasAnalysisFrameLogUseCase, input);
    }

    getPublicCanvasRasterMetadata(input: UseCaseInput<GetPublicCanvasRasterMetadataUseCase>) {
        return this.run(this.getPublicCanvasRasterMetadataUseCase, input);
    }

    getPublicCanvasAtoms(input: UseCaseInput<GetPublicCanvasAtomsUseCase>) {
        return this.run(this.getPublicCanvasAtomsUseCase, input);
    }
}
