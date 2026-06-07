import { Resource } from '@core/constants/resources';
import DeleteTrajectoryFolderUseCase from '@modules/trajectory/application/use-cases/trajectory/DeleteTrajectoryFolderUseCase';
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
        router.get('/scene-artifacts', controllers.listTeamSceneArtifacts.handle);
        router.post('/upload-sessions', controllers.createUploadSession.handle);
        router.post('/upload-sessions/:uploadSessionId/commit', controllers.commitUploadSession.handle);
        router.delete('/upload-sessions/:uploadSessionId', controllers.cancelUploadSession.handle);
        router.route('/')
            .get(controllers.getByTeamId.handle);
        router.post('/clones', controllers.cloneTrajectory.handle);
        router.get('/folders', folderHandlers.list);
        router.get('/folders/:folderId', folderHandlers.get);
        router.post('/folders', folderHandlers.create);
        router.patch('/folders/:folderId', folderHandlers.update);
        router.delete('/folders/:folderId', folderHandlers.delete);
        router.get('/metrics', controllers.getMetrics.handle);
        router.get('/:trajectoryId/preview', controllers.getPreview.handle);
        router.get('/:trajectoryId/analyses/download', controllers.downloadTrajectoryAnalyses.handle);
        router.get('/:trajectoryId/download', controllers.downloadTrajectory.handle);
        router.get('/:trajectoryId/frame/:timestep/atoms', controllers.getAtomsBinary.handle);
        router.get('/:trajectoryId/scene-artifacts', controllers.getSceneArtifacts.handle);
        router.patch('/:trajectoryId/folder', controllers.move.handle);
        router.route('/:trajectoryId')
            .get(controllers.getById.handle)
            .patch(controllers.updateById.handle)
            .delete(controllers.deleteById.handle);
    }
});
