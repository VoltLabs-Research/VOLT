import controllers from '@modules/trajectory/infrastructure/http/controllers/canvas';
import { canvasValidation } from '@modules/trajectory/infrastructure/http/validation/canvas';
import { authenticateOptional } from '@shared/infrastructure/http/middleware/authentication';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/canvas',
    middleware: authenticateOptional,
    routes: (router) => {
        router.get('/:trajectoryId/bootstrap', canvasValidation.getBootstrap, controllers.bootstrap.handle);
        router.get('/:trajectoryId', canvasValidation.getTrajectory, controllers.trajectory.handle);
        router.get('/:trajectoryId/preview', canvasValidation.getPreview, controllers.preview.handle);
        router.get('/:trajectoryId/analyses', canvasValidation.listAnalyses, controllers.analyses.handle);
        router.get('/:trajectoryId/dumps/:timestep', canvasValidation.getDump, controllers.dump.handle);
        router.get('/:trajectoryId/glb/:timestep/:analysisId', canvasValidation.getGlb, controllers.glb.handle);
        router.get('/:trajectoryId/frames/:timestep', canvasValidation.getFrame, controllers.rasterFrame.handle);
        router.get('/:trajectoryId/frames/:timestep/:analysisId/:model', canvasValidation.getAnalysisFrame, controllers.analysisRasterFrame.handle);

        router.get('/:trajectoryId/atoms', canvasValidation.getAtoms, controllers.atoms.handle);
        router.get('/:trajectoryId/simulation-cell', canvasValidation.getSimulationCell, controllers.simulationCell.handle);
        router.get('/:trajectoryId/scene-artifacts', canvasValidation.listSceneArtifacts, controllers.sceneArtifacts.handle);

        router.get('/:trajectoryId/color-coding/properties', canvasValidation.getColorCodingProperties, controllers.colorCodingProperties.handle);
        router.get('/:trajectoryId/color-coding/properties/:analysisId', canvasValidation.getColorCodingPropertiesByAnalysis, controllers.colorCodingPropertiesByAnalysis.handle);
        router.get('/:trajectoryId/color-coding/stats', canvasValidation.getColorCodingStats, controllers.colorCodingStats.handle);
        router.get('/:trajectoryId/color-coding/stats/:analysisId', canvasValidation.getColorCodingStatsByAnalysis, controllers.colorCodingStatsByAnalysis.handle);
        router.get('/:trajectoryId/color-coding/model', canvasValidation.getColorCodingModel, controllers.colorCodingModel.handle);
        router.get('/:trajectoryId/color-coding/model/:analysisId', canvasValidation.getColorCodingModelByAnalysis, controllers.colorCodingModelByAnalysis.handle);

        router.get('/:trajectoryId/particle-filter/properties', canvasValidation.getParticleFilterProperties, controllers.particleFilterProperties.handle);
        router.get('/:trajectoryId/particle-filter/properties/:analysisId', canvasValidation.getParticleFilterPropertiesByAnalysis, controllers.particleFilterPropertiesByAnalysis.handle);
        router.get('/:trajectoryId/particle-filter/unique-values', canvasValidation.getParticleFilterUniqueValues, controllers.particleFilterUniqueValues.handle);
        router.get('/:trajectoryId/particle-filter/unique-values/:analysisId', canvasValidation.getParticleFilterUniqueValuesByAnalysis, controllers.particleFilterUniqueValuesByAnalysis.handle);
        router.get('/:trajectoryId/particle-filter/preview', canvasValidation.getParticleFilterPreview, controllers.particleFilterPreview.handle);
        router.get('/:trajectoryId/particle-filter/preview/:analysisId', canvasValidation.getParticleFilterPreviewByAnalysis, controllers.particleFilterPreviewByAnalysis.handle);
        router.get('/:trajectoryId/particle-filter/model', canvasValidation.getParticleFilterModel, controllers.particleFilterModel.handle);
        router.get('/:trajectoryId/particle-filter/model/:analysisId', canvasValidation.getParticleFilterModelByAnalysis, controllers.particleFilterModelByAnalysis.handle);

        router.get('/:trajectoryId/plugins/:pluginId', canvasValidation.getPlugin, controllers.plugin.handle);
        router.get('/:trajectoryId/plugins/:pluginId/listings', canvasValidation.getListing, controllers.pluginListing.handle);
        router.get('/:trajectoryId/analyses/:analysisId/sub-listings/:exposureId/:timestep/:subListingName', canvasValidation.getSubListing, controllers.subListing.handle);
        router.get('/:trajectoryId/exposures/:analysisId/:exposureId/:timestep/glb', canvasValidation.getExposureGlb, controllers.exposureGlb.handle);
        router.get('/:trajectoryId/analyses/:analysisId/logs/:timestep', canvasValidation.getFrameLog, controllers.frameLog.handle);
        router.get('/:trajectoryId/raster-metadata', canvasValidation.getRasterMetadata, controllers.rasterMetadata.handle);
    }
});
