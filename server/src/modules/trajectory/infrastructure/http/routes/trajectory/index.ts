import { Resource } from '@core/constants/resources';
import DeleteTrajectoryFolderUseCase from '@modules/trajectory/application/use-cases/trajectory/DeleteTrajectoryFolderUseCase';
import TrajectoryController from '@modules/trajectory/infrastructure/http/controllers/TrajectoryController';
import TrajectoryFolderRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryFolderRepository';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createCatalogFolderRouteHandlers } from '@shared/infrastructure/http/routing/catalog-folder-route-handlers';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

const controller = container.resolve(TrajectoryController);

const folderHandlers = createCatalogFolderRouteHandlers({
    repository: container.resolve(TrajectoryFolderRepository),
    folderLabel: 'Trajectory folder',
    deleteFolder: (input) => container.resolve(DeleteTrajectoryFolderUseCase).execute(input),
    deleteStatusCode: HttpStatus.NoContent
});

export default createHttpModule({
    moduleKey: 'trajectory',
    basePath: '/api/trajectories/:teamId',
    resource: Resource.TRAJECTORY,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/samples', controller.listSamples);
        router.get('/samples/:filename', controller.downloadSamples);
        router.get('/scene-artifacts', controller.listTeamSceneArtifacts);
        router.post('/upload-sessions', controller.createUploadSession);
        router.post('/upload-sessions/:uploadSessionId/commit', controller.commitUploadSession);
        router.delete('/upload-sessions/:uploadSessionId', controller.cancelUploadSession);
        router.route('/')
            .get(controller.getByTeamId);
        router.post('/clones', controller.cloneTrajectory);
        router.get('/folders', folderHandlers.list);
        router.get('/folders/:folderId', folderHandlers.get);
        router.post('/folders', folderHandlers.create);
        router.patch('/folders/:folderId', folderHandlers.update);
        router.delete('/folders/:folderId', folderHandlers.delete);
        router.get('/metrics', controller.getMetrics);
        router.get('/:trajectoryId/preview', controller.getPreview);
        router.get('/:trajectoryId/analyses/download', controller.downloadTrajectoryAnalyses);
        router.get('/:trajectoryId/download', controller.downloadTrajectory);
        router.get('/:trajectoryId/frame/:timestep/atoms', controller.getAtomsBinary);
        router.get('/:trajectoryId/scene-artifacts', controller.getSceneArtifacts);
        router.patch('/:trajectoryId/folder', controller.move);
        router.route('/:trajectoryId')
            .get(controller.getById)
            .patch(controller.updateById)
            .delete(controller.deleteById);
    }
});
