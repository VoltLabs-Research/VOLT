import { Resource } from '@core/constants/resources';
import DeleteTrajectoryFolderUseCase from '@modules/trajectory/application/use-cases/trajectory/DeleteTrajectoryFolderUseCase';
import { trajectoryValidation } from '@modules/trajectory/infrastructure/http/validation/trajectory';
import TrajectoryFolderRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryFolderRepository';
import controllers from '@modules/trajectory/infrastructure/http/controllers/trajectory';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createCatalogFolderRouteHandlers } from '@shared/infrastructure/http/routing/catalog-folder-route-handlers';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

const folderHandlers = createCatalogFolderRouteHandlers({
    repository: container.resolve(TrajectoryFolderRepository),
    folderLabel: 'Trajectory folder',
    deleteFolder: (input) => container.resolve(DeleteTrajectoryFolderUseCase).execute(input),
    deleteStatusCode: HttpStatus.NoContent
});

export default createHttpModule({
    basePath: '/api/trajectories/:teamId',
    resource: Resource.TRAJECTORY,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/samples', controllers.listSamples.handle);
        router.get('/samples/:filename', controllers.downloadSamples.handle);
        router.get('/scene-artifacts', trajectoryValidation.listTeamSceneArtifacts, controllers.listTeamSceneArtifacts.handle);
        router.post('/upload-sessions', trajectoryValidation.createUploadSession, controllers.createUploadSession.handle);
        router.post('/upload-sessions/:uploadSessionId/commit', trajectoryValidation.commitUploadSession, controllers.commitUploadSession.handle);
        router.delete('/upload-sessions/:uploadSessionId', trajectoryValidation.cancelUploadSession, controllers.cancelUploadSession.handle);
        router.route('/')
            .get(trajectoryValidation.listByTeamId, controllers.getByTeamId.handle);
        router.post('/clones', trajectoryValidation.clone, controllers.cloneTrajectory.handle);
        router.get('/folders', trajectoryValidation.listFolders, folderHandlers.list);
        router.get('/folders/:folderId', trajectoryValidation.getFolder, folderHandlers.get);
        router.post('/folders', trajectoryValidation.createFolder, folderHandlers.create);
        router.patch('/folders/:folderId', trajectoryValidation.updateFolder, folderHandlers.update);
        router.delete('/folders/:folderId', trajectoryValidation.deleteFolder, folderHandlers.delete);
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
