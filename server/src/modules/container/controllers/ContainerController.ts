import Controller, { Middleware } from '@shared/http/Controller';
import { Route, Status } from '@shared/http/route';
import { Body, Param, Query, CurrentUser } from '@shared/http/params';
import { teamScoped } from '@modules/team/controllers/middleware/team-scoped';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import { Resource } from '@core/constants/resources';
import ContainerService from '@modules/container/services/ContainerService';
import { createContainer, deleteContainer } from '@modules/container/services/container-provisioning';
import { updateContainer } from '@modules/container/services/container-runtime-updates';
import { createContainerPortAccessUrl } from '@modules/container/services/container-port-access';
import containerFolderService from '@modules/container/services/ContainerFolderService';
import containerRuntimeInspectionService from '@modules/container/services/ContainerRuntimeInspectionService';
import { containerRoutes } from '@volt/contracts/modules/container/routes';
import type {
    CreateContainerInput,
    UpdateContainerInput,
    MoveContainerInput,
    CreateContainerFolderInput,
    UpdateContainerFolderInput
} from '@volt/contracts/modules/container/http';

@Middleware(protect, teamScoped(Resource.CONTAINER))
export default class ContainerController extends Controller {
    #service = new ContainerService();

    @Route(containerRoutes.create)
    @Status(201)
    create(
        @Param('teamId') teamId: string,
        @CurrentUser() userId: string,
        @Body() body: CreateContainerInput
    ){
        return createContainer(teamId, userId, body);
    }

    @Route(containerRoutes.list)
    list(
        @Param('teamId') teamId: string,
        @Query() query: Record<string, string>
    ){
        return this.#service.list(teamId, query);
    }

    @Route(containerRoutes.listFolders)
    listFolders(
        @Param('teamId') teamId: string,
        @Query() query: Record<string, string>
    ){
        return containerFolderService.list(teamId, query);
    }

    @Route(containerRoutes.getFolder)
    getFolder(
        @Param('teamId') teamId: string,
        @Param('folderId') folderId: string
    ){
        return containerFolderService.get(teamId, folderId);
    }

    @Route(containerRoutes.createFolder)
    @Status(201)
    createFolder(
        @Param('teamId') teamId: string,
        @CurrentUser() userId: string,
        @Body() body: CreateContainerFolderInput
    ){
        return containerFolderService.create(teamId, userId, body);
    }

    @Route(containerRoutes.updateFolder)
    updateFolder(
        @Param('teamId') teamId: string,
        @Param('folderId') folderId: string,
        @Body() body: UpdateContainerFolderInput
    ){
        return containerFolderService.update(teamId, folderId, body);
    }

    @Route(containerRoutes.removeFolder)
    async removeFolder(
        @Param('teamId') teamId: string,
        @Param('folderId') folderId: string,
        @CurrentUser() userId: string
    ){
        await containerFolderService.delete(teamId, folderId, userId);
    }

    @Route(containerRoutes.get)
    getById(
        @Param('teamId') teamId: string,
        @Param('containerId') containerId: string
    ){
        return this.#service.getById(teamId, containerId);
    }

    @Route(containerRoutes.update)
    updateById(
        @Param('teamId') teamId: string,
        @Param('containerId') containerId: string,
        @Body() body: UpdateContainerInput
    ){
        return updateContainer(teamId, containerId, body);
    }

    @Route(containerRoutes.remove)
    async deleteById(
        @Param('teamId') teamId: string,
        @Param('containerId') containerId: string,
        @CurrentUser() userId: string
    ){
        await deleteContainer(teamId, containerId, userId);
    }

    @Route(containerRoutes.createPortAccessUrl)
    createPortAccessUrl(
        @Param('teamId') teamId: string,
        @Param('containerId') containerId: string,
        @Param('privatePort') privatePort: string,
        @CurrentUser() userId: string
    ) {
        return createContainerPortAccessUrl(teamId, containerId, Number(privatePort), userId);
    }

    @Route(containerRoutes.move)
    @Status(200)
    async move(
        @Param('teamId') teamId: string,
        @Param('containerId') containerId: string,
        @Body() body: MoveContainerInput
    ){
        return this.#service.move(teamId, containerId, body.folderId);
    }

    @Route(containerRoutes.getFiles)
    getFilesById(
        @Param('teamId') teamId: string,
        @Param('containerId') containerId: string,
        @Query('path') path: string
    ){
        return containerRuntimeInspectionService.getFiles(teamId, containerId, path);
    }

    @Route(containerRoutes.getProcesses)
    getProcessesById(
        @Param('teamId') teamId: string,
        @Param('containerId') containerId: string
    ){
        return containerRuntimeInspectionService.getProcesses(teamId, containerId);
    }

    @Route(containerRoutes.getStats)
    getStatsById(
        @Param('teamId') teamId: string,
        @Param('containerId') containerId: string
    ){
        return containerRuntimeInspectionService.getStats(teamId, containerId);
    }

    @Route(containerRoutes.readFile)
    readFileById(
        @Param('teamId') teamId: string,
        @Param('containerId') containerId: string,
        @Query('path') path: string
    ){
        return containerRuntimeInspectionService.readFile(teamId, containerId, path);
    }
}
