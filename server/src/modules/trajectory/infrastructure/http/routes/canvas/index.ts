import controllers from '@modules/trajectory/infrastructure/http/controllers/canvas';
import { authenticateOptional } from '@shared/infrastructure/http/middleware/authentication';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/canvas',
    routes: (router) => {
        router.use(authenticateOptional);

        router.get('/:trajectoryId/bootstrap', controllers.bootstrap.handle);
        router.get('/:trajectoryId', controllers.trajectory.handle);
        router.get('/:trajectoryId/preview', controllers.preview.handle);
        router.get('/:trajectoryId/analyses', controllers.analyses.handle);
        router.get('/:trajectoryId/dumps/:timestep', controllers.dump.handle);
        router.get('/:trajectoryId/glb/:timestep/:analysisId', controllers.glb.handle);
        router.get('/:trajectoryId/frames/:timestep', controllers.rasterFrame.handle);
        router.get('/:trajectoryId/frames/:timestep/:analysisId/:model', controllers.analysisRasterFrame.handle);

        // Why: binary transferables — see GetPublicCanvasAtomsBinaryController
        // (F2.S4). Legacy JSON path removed; the Canvas client now decodes the
        // columnar body directly into TypedArrays without a JSON.parse pass.
        router.get('/:trajectoryId/frame/:timestep/atoms', controllers.atomsBinary.handle);
        router.get('/:trajectoryId/simulation-cell', controllers.simulationCell.handle);
        router.get('/:trajectoryId/scene-artifacts', controllers.sceneArtifacts.handle);

        router.get('/:trajectoryId/color-coding/properties', controllers.colorCodingProperties.handle);
        router.get('/:trajectoryId/color-coding/properties/:analysisId', controllers.colorCodingPropertiesByAnalysis.handle);
        router.get('/:trajectoryId/color-coding/stats', controllers.colorCodingStats.handle);
        router.get('/:trajectoryId/color-coding/stats/:analysisId', controllers.colorCodingStatsByAnalysis.handle);
        router.get('/:trajectoryId/color-coding/model', controllers.colorCodingModel.handle);
        router.get('/:trajectoryId/color-coding/model/:analysisId', controllers.colorCodingModelByAnalysis.handle);

        router.get('/:trajectoryId/particle-filter/properties', controllers.particleFilterProperties.handle);
        router.get('/:trajectoryId/particle-filter/properties/:analysisId', controllers.particleFilterPropertiesByAnalysis.handle);
        router.get('/:trajectoryId/particle-filter/unique-values', controllers.particleFilterUniqueValues.handle);
        router.get('/:trajectoryId/particle-filter/unique-values/:analysisId', controllers.particleFilterUniqueValuesByAnalysis.handle);
        router.get('/:trajectoryId/particle-filter/preview', controllers.particleFilterPreview.handle);
        router.get('/:trajectoryId/particle-filter/preview/:analysisId', controllers.particleFilterPreviewByAnalysis.handle);
        router.get('/:trajectoryId/particle-filter/model', controllers.particleFilterModel.handle);
        router.get('/:trajectoryId/particle-filter/model/:analysisId', controllers.particleFilterModelByAnalysis.handle);

        router.get('/:trajectoryId/plugins/:pluginId', controllers.plugin.handle);
        router.get('/:trajectoryId/plugins/:pluginId/listings', controllers.pluginListing.handle);
        router.get('/:trajectoryId/analyses/:analysisId/sub-listings/:exposureId/:timestep/:subListingName', controllers.subListing.handle);
        router.get('/:trajectoryId/exposures/:analysisId/:exposureId/:timestep/glb', controllers.exposureGlb.handle);
        router.get('/:trajectoryId/analyses/:analysisId/logs/:timestep', controllers.frameLog.handle);
        router.get('/:trajectoryId/raster-metadata', controllers.rasterMetadata.handle);
    }
});
