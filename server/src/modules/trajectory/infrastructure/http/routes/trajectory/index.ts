import { Resource } from '@core/constants/resources';
import { trajectoryValidation } from '@modules/trajectory/infrastructure/http/validation/trajectory';
import { uploadTrajectoryFiles } from '@shared/infrastructure/http/middleware/upload';
import controllers from '@modules/trajectory/infrastructure/http/controllers/trajectory';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/trajectories/:teamId',
    resource: Resource.TRAJECTORY,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/samples', controllers.listSamples.handle);
        router.get('/samples/:filename', controllers.downloadSamples.handle);
        router.get('/scene-artifacts', trajectoryValidation.listTeamSceneArtifacts, controllers.listTeamSceneArtifacts.handle);
        router.route('/')
            .post(uploadTrajectoryFiles('trajectoryFiles'), controllers.create.handle)
            .get(trajectoryValidation.listByTeamId, controllers.getByTeamId.handle);
        router.post('/clones', trajectoryValidation.clone, controllers.cloneTrajectory.handle);
        router.get('/folders', trajectoryValidation.listFolders, controllers.listFolders.handle);
        router.get('/folders/:folderId', trajectoryValidation.getFolder, controllers.getFolder.handle);
        router.post('/folders', trajectoryValidation.createFolder, controllers.createFolder.handle);
        router.patch('/folders/:folderId', trajectoryValidation.updateFolder, controllers.updateFolder.handle);
        router.delete('/folders/:folderId', trajectoryValidation.deleteFolder, controllers.deleteFolder.handle);
        router.get('/metrics', trajectoryValidation.getMetrics, controllers.getMetrics.handle);
        router.get('/:trajectoryId/preview', trajectoryValidation.getPreview, controllers.getPreview.handle);
        router.get('/:trajectoryId/analyses/download', trajectoryValidation.downloadTrajectoryAnalyses, controllers.downloadTrajectoryAnalyses.handle);
        router.get('/:trajectoryId/download', trajectoryValidation.downloadTrajectory, controllers.downloadTrajectory.handle);
        router.get('/:trajectoryId/frame/:timestep/atoms', controllers.getAtomsBinary.handle);
        router.get('/:trajectoryId/scene-artifacts', trajectoryValidation.getSceneArtifacts, controllers.getSceneArtifacts.handle);
        router.patch('/:trajectoryId/folder', trajectoryValidation.move, controllers.move.handle);
        router.route('/:trajectoryId')
            .get(trajectoryValidation.getById, controllers.getById.handle)
            .patch(trajectoryValidation.update, controllers.updateById.handle)
            .delete(controllers.deleteById.handle);
    }
});
