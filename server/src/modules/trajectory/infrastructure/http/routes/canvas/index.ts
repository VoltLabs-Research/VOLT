import TrajectoryController from '@modules/trajectory/infrastructure/http/controllers/TrajectoryController';
import { authenticateOptional } from '@shared/infrastructure/http/middleware/authentication';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

const controller = container.resolve(TrajectoryController);

export default createHttpModule({
    moduleKey: 'trajectory',
    basePath: '/api/canvas',
    routes: (router) => {
        router.use(authenticateOptional);

        router.get('/:trajectoryId/bootstrap', controller.canvasBootstrap);
        router.get('/:trajectoryId', controller.canvasTrajectory);
        router.get('/:trajectoryId/preview', controller.canvasPreview);
        router.get('/:trajectoryId/analyses', controller.canvasAnalyses);
        router.get('/:trajectoryId/dumps/:timestep', controller.canvasDump);
        router.get('/:trajectoryId/glb/:timestep/:analysisId', controller.canvasGlb);
        router.get('/:trajectoryId/frames/:timestep', controller.canvasRasterFrame);
        router.get('/:trajectoryId/frames/:timestep/:analysisId/:model', controller.canvasRasterFrame);

        router.get('/:trajectoryId/frame/:timestep/atoms', controller.canvasAtomsBinary);
        router.get('/:trajectoryId/simulation-cell', controller.canvasSimulationCell);
        router.get('/:trajectoryId/scene-artifacts', controller.canvasSceneArtifacts);

        router.get('/:trajectoryId/color-coding/properties', controller.canvasColorCodingProperties);
        router.get('/:trajectoryId/color-coding/properties/:analysisId', controller.canvasColorCodingProperties);
        router.get('/:trajectoryId/color-coding/stats', controller.canvasColorCodingStats);
        router.get('/:trajectoryId/color-coding/stats/:analysisId', controller.canvasColorCodingStats);
        router.get('/:trajectoryId/color-coding/model', controller.canvasColorCodingModel);
        router.get('/:trajectoryId/color-coding/model/:analysisId', controller.canvasColorCodingModel);

        router.get('/:trajectoryId/particle-filter/properties', controller.canvasParticleFilterProperties);
        router.get('/:trajectoryId/particle-filter/properties/:analysisId', controller.canvasParticleFilterProperties);
        router.get('/:trajectoryId/particle-filter/unique-values', controller.canvasParticleFilterUniqueValues);
        router.get('/:trajectoryId/particle-filter/unique-values/:analysisId', controller.canvasParticleFilterUniqueValues);
        router.get('/:trajectoryId/particle-filter/preview', controller.canvasParticleFilterPreview);
        router.get('/:trajectoryId/particle-filter/preview/:analysisId', controller.canvasParticleFilterPreview);
        router.get('/:trajectoryId/particle-filter/model', controller.canvasParticleFilterModel);
        router.get('/:trajectoryId/particle-filter/model/:analysisId', controller.canvasParticleFilterModel);

        router.get('/:trajectoryId/plugins/:pluginId', controller.canvasPlugin);
        router.get('/:trajectoryId/plugins/:pluginId/listings', controller.canvasPluginListing);
        router.get('/:trajectoryId/analyses/:analysisId/sub-listings/:exposureId/:timestep/:subListingName', controller.canvasSubListing);
        router.get('/:trajectoryId/exposures/:analysisId/:exposureId/:timestep/glb', controller.canvasExposureGlb);
        router.get('/:trajectoryId/analyses/:analysisId/logs/:timestep', controller.canvasFrameLog);
        router.get('/:trajectoryId/raster-metadata', controller.canvasRasterMetadata);
    }
});
