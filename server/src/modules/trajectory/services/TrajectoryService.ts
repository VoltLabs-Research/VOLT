import CancelTrajectoryUploadSessionUseCase from '@modules/trajectory/use-cases/trajectory/CancelTrajectoryUploadSessionUseCase';
import CloneTrajectoryUseCase from '@modules/trajectory/use-cases/trajectory/CloneTrajectoryUseCase';
import CommitTrajectoryUploadSessionUseCase from '@modules/trajectory/use-cases/trajectory/CommitTrajectoryUploadSessionUseCase';
import CreateTrajectoryUploadSessionUseCase from '@modules/trajectory/use-cases/trajectory/CreateTrajectoryUploadSessionUseCase';
import DeleteTrajectoryByIdUseCase from '@modules/trajectory/use-cases/trajectory/DeleteTrajectoryByIdUseCase';
import DownloadSampleSimulationsUseCase from '@modules/trajectory/use-cases/trajectory/DownloadSampleSimulationsUseCase';
import DownloadTrajectoryAnalysesUseCase from '@modules/trajectory/use-cases/trajectory/DownloadTrajectoryAnalysesUseCase';
import DownloadTrajectoryUseCase from '@modules/trajectory/use-cases/trajectory/DownloadTrajectoryUseCase';
import GetTeamMetricsUseCase from '@modules/trajectory/use-cases/trajectory/GetTeamMetricsUseCase';
import GetTrajectoriesByTeamIdUseCase from '@modules/trajectory/use-cases/trajectory/GetTrajectoriesByTeamIdUseCase';
import GetTrajectoryByIdUseCase from '@modules/trajectory/use-cases/trajectory/GetTrajectoryByIdUseCase';
import GetTrajectoryPreviewUseCase from '@modules/trajectory/use-cases/trajectory/GetTrajectoryPreviewUseCase';
import ListPublicTeamTrajectoriesUseCase from '@modules/trajectory/use-cases/trajectory/ListPublicTeamTrajectoriesUseCase';
import ListSampleSimulationsUseCase from '@modules/trajectory/use-cases/trajectory/ListSampleSimulationsUseCase';
import MoveTrajectoryUseCase from '@modules/trajectory/use-cases/trajectory/MoveTrajectoryUseCase';
import UpdateTrajectoryByIdUseCase from '@modules/trajectory/use-cases/trajectory/UpdateTrajectoryByIdUseCase';
import { GetAtomsUseCase } from '@modules/trajectory/use-cases/trajectory/GetAtomsUseCase';
import { ListTeamSceneArtifactsUseCase } from '@modules/trajectory/use-cases/scene-artifacts/ListTeamSceneArtifactsUseCase';
import { ListTrajectorySceneArtifactsUseCase } from '@modules/trajectory/use-cases/scene-artifacts/ListTrajectorySceneArtifactsUseCase';
import { CreateColoredModelUseCase } from '@modules/trajectory/use-cases/color-coding/CreateColoredModelUseCase';
import { GetColorCodingPropertiesUseCase } from '@modules/trajectory/use-cases/color-coding/GetColorCodingPropertiesUseCase';
import { GetColorCodingStatsUseCase } from '@modules/trajectory/use-cases/color-coding/GetColorCodingStatsUseCase';
import { GetColoredModelStreamUseCase } from '@modules/trajectory/use-cases/color-coding/GetColoredModelStreamUseCase';
import { ApplyParticleFilterActionUseCase } from '@modules/trajectory/use-cases/particle-filter/ApplyParticleFilterActionUseCase';
import { GetFilteredModelStreamUseCase } from '@modules/trajectory/use-cases/particle-filter/GetFilteredModelStreamUseCase';
import { GetParticleFilterPropertiesUseCase } from '@modules/trajectory/use-cases/particle-filter/GetParticleFilterPropertiesUseCase';
import { GetParticleFilterUniqueValuesUseCase } from '@modules/trajectory/use-cases/particle-filter/GetParticleFilterUniqueValuesUseCase';
import { PreviewParticleFilterUseCase } from '@modules/trajectory/use-cases/particle-filter/PreviewParticleFilterUseCase';
import { CreateLineStyledModelUseCase } from '@modules/trajectory/use-cases/line-style/CreateLineStyledModelUseCase';
import { GetLineEntityPropertiesUseCase } from '@modules/trajectory/use-cases/line-style/GetLineEntityPropertiesUseCase';
import { GetLineModelRangesStreamUseCase } from '@modules/trajectory/use-cases/line-style/GetLineModelRangesStreamUseCase';
import { GetLineStyledModelStreamUseCase } from '@modules/trajectory/use-cases/line-style/GetLineStyledModelStreamUseCase';
import { GetOctreeMetadataStreamUseCase } from '@modules/trajectory/use-cases/lod/GetOctreeMetadataStreamUseCase';
import { GetPublicCanvasAnalysisFrameLogUseCase } from '@modules/trajectory/use-cases/canvas/GetPublicCanvasAnalysisFrameLogUseCase';
import { GetPublicCanvasAtomsUseCase } from '@modules/trajectory/use-cases/canvas/GetPublicCanvasAtomsUseCase';
import { GetPublicCanvasBootstrapUseCase } from '@modules/trajectory/use-cases/canvas/GetPublicCanvasBootstrapUseCase';
import { GetPublicCanvasColorCodingPropertiesUseCase } from '@modules/trajectory/use-cases/canvas/GetPublicCanvasColorCodingPropertiesUseCase';
import { GetPublicCanvasColorCodingStatsUseCase } from '@modules/trajectory/use-cases/canvas/GetPublicCanvasColorCodingStatsUseCase';
import { GetPublicCanvasColoredModelStreamUseCase } from '@modules/trajectory/use-cases/canvas/GetPublicCanvasColoredModelStreamUseCase';
import { GetPublicCanvasDumpUseCase } from '@modules/trajectory/use-cases/canvas/GetPublicCanvasDumpUseCase';
import { GetPublicCanvasFilteredModelStreamUseCase } from '@modules/trajectory/use-cases/canvas/GetPublicCanvasFilteredModelStreamUseCase';
import { GetPublicCanvasGLBUseCase } from '@modules/trajectory/use-cases/canvas/GetPublicCanvasGLBUseCase';
import { GetPublicCanvasParticleFilterPreviewUseCase } from '@modules/trajectory/use-cases/canvas/GetPublicCanvasParticleFilterPreviewUseCase';
import { GetPublicCanvasParticleFilterPropertiesUseCase } from '@modules/trajectory/use-cases/canvas/GetPublicCanvasParticleFilterPropertiesUseCase';
import { GetPublicCanvasParticleFilterUniqueValuesUseCase } from '@modules/trajectory/use-cases/canvas/GetPublicCanvasParticleFilterUniqueValuesUseCase';
import { GetPublicCanvasPluginExposureGLBUseCase } from '@modules/trajectory/use-cases/canvas/GetPublicCanvasPluginExposureGLBUseCase';
import { GetPublicCanvasPluginListingUseCase } from '@modules/trajectory/use-cases/canvas/GetPublicCanvasPluginListingUseCase';
import { GetPublicCanvasPluginUseCase } from '@modules/trajectory/use-cases/canvas/GetPublicCanvasPluginUseCase';
import { GetPublicCanvasPreviewUseCase } from '@modules/trajectory/use-cases/canvas/GetPublicCanvasPreviewUseCase';
import { GetPublicCanvasRasterFrameUseCase } from '@modules/trajectory/use-cases/canvas/GetPublicCanvasRasterFrameUseCase';
import { GetPublicCanvasRasterMetadataUseCase } from '@modules/trajectory/use-cases/canvas/GetPublicCanvasRasterMetadataUseCase';
import { GetPublicCanvasSimulationCellUseCase } from '@modules/trajectory/use-cases/canvas/GetPublicCanvasSimulationCellUseCase';
import { GetPublicCanvasSubListingUseCase } from '@modules/trajectory/use-cases/canvas/GetPublicCanvasSubListingUseCase';
import { GetPublicCanvasTrajectoryUseCase } from '@modules/trajectory/use-cases/canvas/GetPublicCanvasTrajectoryUseCase';
import { ListPublicCanvasAnalysesUseCase } from '@modules/trajectory/use-cases/canvas/ListPublicCanvasAnalysesUseCase';
import { ListPublicCanvasSceneArtifactsUseCase } from '@modules/trajectory/use-cases/canvas/ListPublicCanvasSceneArtifactsUseCase';
import { container } from 'tsyringe';

import type { IUseCase, UseCaseInput, UseCaseOutput } from '@shared/application/IUseCase';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';

/**
 * The single HTTP-facing application service for the trajectory module, `new`ed
 * directly by the module's controllers (pollium style — no DI decorator, no
 * `@inject` constructor, so it is trivially `new`-able).
 *
 * Each method is a thin delegator to a retained use case resolved once from the
 * DI container in a private field: the use case throws `ApplicationError`s
 * directly (they propagate to `httpErrorMiddleware` via Express 5 async
 * forwarding). The heavy stateful collaborators (native daemon, trajectory
 * reader/parser, particle-filter / color-coding / line-style render services,
 * dump storage, canvas realtime state and scene-artifact services) stay in
 * their own `@Singleton` classes and are reached transitively through those use
 * cases — they hold caches / daemon connections that must be shared with the
 * socket modules and event handlers, so they are NOT re-`new`ed per request.
 */
export default class TrajectoryService {
    // Use cases resolved once from the DI container (they and the heavy
    // stateful services they depend on self-register via `@Singleton` /
    // `@injectable` at autoload).
    private readonly createTrajectoryUploadSessionUseCase = container.resolve(CreateTrajectoryUploadSessionUseCase);
    private readonly commitTrajectoryUploadSessionUseCase = container.resolve(CommitTrajectoryUploadSessionUseCase);
    private readonly cancelTrajectoryUploadSessionUseCase = container.resolve(CancelTrajectoryUploadSessionUseCase);
    private readonly deleteTrajectoryByIdUseCase = container.resolve(DeleteTrajectoryByIdUseCase);
    private readonly getTeamMetricsUseCase = container.resolve(GetTeamMetricsUseCase);
    private readonly getTrajectoriesByTeamIdUseCase = container.resolve(GetTrajectoriesByTeamIdUseCase);
    private readonly getTrajectoryByIdUseCase = container.resolve(GetTrajectoryByIdUseCase);
    private readonly updateTrajectoryByIdUseCase = container.resolve(UpdateTrajectoryByIdUseCase);
    private readonly moveTrajectoryUseCase = container.resolve(MoveTrajectoryUseCase);
    private readonly listSampleSimulationsUseCase = container.resolve(ListSampleSimulationsUseCase);
    private readonly cloneTrajectoryUseCase = container.resolve(CloneTrajectoryUseCase);
    private readonly getTrajectoryPreviewUseCase = container.resolve(GetTrajectoryPreviewUseCase);
    private readonly downloadTrajectoryUseCase = container.resolve(DownloadTrajectoryUseCase);
    private readonly downloadTrajectoryAnalysesUseCase = container.resolve(DownloadTrajectoryAnalysesUseCase);
    private readonly downloadSampleSimulationsUseCase = container.resolve(DownloadSampleSimulationsUseCase);
    private readonly getAtomsUseCase = container.resolve(GetAtomsUseCase);
    private readonly listTrajectorySceneArtifactsUseCase = container.resolve(ListTrajectorySceneArtifactsUseCase);
    private readonly listTeamSceneArtifactsUseCase = container.resolve(ListTeamSceneArtifactsUseCase);
    private readonly getColorCodingPropertiesUseCase = container.resolve(GetColorCodingPropertiesUseCase);
    private readonly getColorCodingStatsUseCase = container.resolve(GetColorCodingStatsUseCase);
    private readonly createColoredModelUseCase = container.resolve(CreateColoredModelUseCase);
    private readonly getColoredModelStreamUseCase = container.resolve(GetColoredModelStreamUseCase);
    private readonly getParticleFilterPropertiesUseCase = container.resolve(GetParticleFilterPropertiesUseCase);
    private readonly previewParticleFilterUseCase = container.resolve(PreviewParticleFilterUseCase);
    private readonly applyParticleFilterActionUseCase = container.resolve(ApplyParticleFilterActionUseCase);
    private readonly getFilteredModelStreamUseCase = container.resolve(GetFilteredModelStreamUseCase);
    private readonly getParticleFilterUniqueValuesUseCase = container.resolve(GetParticleFilterUniqueValuesUseCase);
    private readonly createLineStyledModelUseCase = container.resolve(CreateLineStyledModelUseCase);
    private readonly getLineStyledModelStreamUseCase = container.resolve(GetLineStyledModelStreamUseCase);
    private readonly getLineModelRangesStreamUseCase = container.resolve(GetLineModelRangesStreamUseCase);
    private readonly getLineEntityPropertiesUseCase = container.resolve(GetLineEntityPropertiesUseCase);
    private readonly getOctreeMetadataStreamUseCase = container.resolve(GetOctreeMetadataStreamUseCase);
    private readonly listPublicTeamTrajectoriesUseCase = container.resolve(ListPublicTeamTrajectoriesUseCase);
    private readonly getPublicCanvasBootstrapUseCase = container.resolve(GetPublicCanvasBootstrapUseCase);
    private readonly getPublicCanvasTrajectoryUseCase = container.resolve(GetPublicCanvasTrajectoryUseCase);
    private readonly getPublicCanvasPreviewUseCase = container.resolve(GetPublicCanvasPreviewUseCase);
    private readonly getPublicCanvasRasterFrameUseCase = container.resolve(GetPublicCanvasRasterFrameUseCase);
    private readonly getPublicCanvasDumpUseCase = container.resolve(GetPublicCanvasDumpUseCase);
    private readonly getPublicCanvasGLBUseCase = container.resolve(GetPublicCanvasGLBUseCase);
    private readonly listPublicCanvasAnalysesUseCase = container.resolve(ListPublicCanvasAnalysesUseCase);
    private readonly getPublicCanvasSimulationCellUseCase = container.resolve(GetPublicCanvasSimulationCellUseCase);
    private readonly listPublicCanvasSceneArtifactsUseCase = container.resolve(ListPublicCanvasSceneArtifactsUseCase);
    private readonly getPublicCanvasColorCodingPropertiesUseCase = container.resolve(GetPublicCanvasColorCodingPropertiesUseCase);
    private readonly getPublicCanvasColorCodingStatsUseCase = container.resolve(GetPublicCanvasColorCodingStatsUseCase);
    private readonly getPublicCanvasColoredModelStreamUseCase = container.resolve(GetPublicCanvasColoredModelStreamUseCase);
    private readonly getPublicCanvasParticleFilterPropertiesUseCase = container.resolve(GetPublicCanvasParticleFilterPropertiesUseCase);
    private readonly getPublicCanvasParticleFilterUniqueValuesUseCase = container.resolve(GetPublicCanvasParticleFilterUniqueValuesUseCase);
    private readonly getPublicCanvasParticleFilterPreviewUseCase = container.resolve(GetPublicCanvasParticleFilterPreviewUseCase);
    private readonly getPublicCanvasFilteredModelStreamUseCase = container.resolve(GetPublicCanvasFilteredModelStreamUseCase);
    private readonly getPublicCanvasPluginUseCase = container.resolve(GetPublicCanvasPluginUseCase);
    private readonly getPublicCanvasPluginListingUseCase = container.resolve(GetPublicCanvasPluginListingUseCase);
    private readonly getPublicCanvasSubListingUseCase = container.resolve(GetPublicCanvasSubListingUseCase);
    private readonly getPublicCanvasPluginExposureGLBUseCase = container.resolve(GetPublicCanvasPluginExposureGLBUseCase);
    private readonly getPublicCanvasAnalysisFrameLogUseCase = container.resolve(GetPublicCanvasAnalysisFrameLogUseCase);
    private readonly getPublicCanvasRasterMetadataUseCase = container.resolve(GetPublicCanvasRasterMetadataUseCase);
    private readonly getPublicCanvasAtomsUseCase = container.resolve(GetPublicCanvasAtomsUseCase);

    /**
     * Runs a use case, delegating to its `execute`. Use cases throw
     * `ApplicationError`s directly, which Express 5 forwards to
     * `httpErrorMiddleware`.
     */
    private async run<TInput, TOutput>(
        useCase: IUseCase<TInput, TOutput>,
        input: TInput
    ): Promise<TOutput> {
        return useCase.execute(input);
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
