import typia from 'typia';
import AIToolController from '@shared/ai/AIToolController';
import { AITool } from '@shared/ai/tool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ContainerService from '@modules/container/services/ContainerService';
import { createContainer, deleteContainer } from '@modules/container/services/container-provisioning';
import { updateContainer } from '@modules/container/services/container-runtime-updates';
import { createContainerPortAccessUrl } from '@modules/container/services/container-port-access';
import containerRuntimeInspectionService from '@modules/container/services/ContainerRuntimeInspectionService';
import type {
    ContainerRefInput,
    CreateContainerInput,
    DeleteContainerInput,
    GetContainerPortAccessUrlInput,
    ListContainerFilesInput,
    ListContainersInput,
    MoveContainerInput,
    ReadContainerFileInput,
    UpdateContainerInput
} from '@volt/contracts/modules/container/ai-tools';

export default class ContainerAIToolController extends AIToolController {
    #service = new ContainerService();

    @AITool({
        name: 'create_container',
        description: 'Create a new Docker container.',
        parameters: typia.llm.parameters<CreateContainerInput>(),
        validate: typia.createValidate<CreateContainerInput>()
    })
    createContainer(input: CreateContainerInput & AIToolScope) {
        return createContainer(input.teamId, input.userId, input);
    }

    @AITool({
        name: 'list_containers',
        description: 'List all Docker containers in the team.',
        parameters: typia.llm.parameters<ListContainersInput>(),
        validate: typia.createValidate<ListContainersInput>()
    })
    async listContainers(input: ListContainersInput & AIToolScope) {
        // typia validates but does not transform, so the documented defaults are
        // applied here; an absent key does not override them on spread.
        const { total, data } = await this.#service.list(input.teamId, {
            page: 1,
            limit: 50,
            ...input
        });
        return {
            summary: `Found ${total} containers.`,
            data
        };
    }

    @AITool({
        name: 'get_container_by_id',
        description: 'Get detailed information about a specific container.',
        parameters: typia.llm.parameters<ContainerRefInput>(),
        validate: typia.createValidate<ContainerRefInput>()
    })
    getContainerById(input: ContainerRefInput & AIToolScope) {
        return this.#service.getById(input.teamId, input.containerId);
    }

    @AITool({
        name: 'get_container_stats',
        description: 'Get resource usage stats for a container.',
        parameters: typia.llm.parameters<ContainerRefInput>(),
        validate: typia.createValidate<ContainerRefInput>()
    })
    getContainerStats(input: ContainerRefInput & AIToolScope) {
        return containerRuntimeInspectionService.getStats(input.teamId, input.containerId);
    }

    @AITool({
        name: 'get_container_processes',
        description: 'List running processes in a container.',
        parameters: typia.llm.parameters<ContainerRefInput>(),
        validate: typia.createValidate<ContainerRefInput>()
    })
    getContainerProcesses(input: ContainerRefInput & AIToolScope) {
        return containerRuntimeInspectionService.getProcesses(input.teamId, input.containerId);
    }

    @AITool({
        name: 'list_container_files',
        description: 'List files in a container directory.',
        parameters: typia.llm.parameters<ListContainerFilesInput>(),
        validate: typia.createValidate<ListContainerFilesInput>()
    })
    listContainerFiles(input: ListContainerFilesInput & AIToolScope) {
        // `path` is positional here, so the documented default cannot ride along on a spread.
        return containerRuntimeInspectionService.getFiles(input.teamId, input.containerId, input.path ?? '/');
    }

    @AITool({
        name: 'read_container_file',
        description: 'Read a file from a container.',
        parameters: typia.llm.parameters<ReadContainerFileInput>(),
        validate: typia.createValidate<ReadContainerFileInput>()
    })
    readContainerFile(input: ReadContainerFileInput & AIToolScope) {
        return containerRuntimeInspectionService.readFile(input.teamId, input.containerId, input.path);
    }

    @AITool({
        name: 'get_container_port_access_url',
        description: 'Generate a temporary browser-accessible URL for an exposed port of a running container.',
        parameters: typia.llm.parameters<GetContainerPortAccessUrlInput>(),
        validate: typia.createValidate<GetContainerPortAccessUrlInput>()
    })
    async getContainerPortAccessUrl(input: GetContainerPortAccessUrlInput & AIToolScope) {
        const accessUrl = await createContainerPortAccessUrl(input.teamId, input.containerId, input.port, input.userId);
        return {
            summary: `Generated a temporary access URL for port ${input.port}.`,
            data: accessUrl
        };
    }

    @AITool({
        name: 'update_container',
        description: 'Update a Docker container.',
        parameters: typia.llm.parameters<UpdateContainerInput>(),
        validate: typia.createValidate<UpdateContainerInput>()
    })
    updateContainer(input: UpdateContainerInput & AIToolScope) {
        return updateContainer(input.teamId, input.containerId, {});
    }

    @AITool({
        name: 'move_container',
        description: 'Move a container into a different folder (pass folderId null to move it to the root).',
        parameters: typia.llm.parameters<MoveContainerInput>(),
        validate: typia.createValidate<MoveContainerInput>(),
        needsApproval: true
    })
    async moveContainer(input: MoveContainerInput & AIToolScope) {
        await this.#service.move(input.teamId, input.containerId, input.folderId);
        return {
            summary: input.folderId === null
                ? 'Moved the container to the root folder.'
                : `Moved the container into folder ${input.folderId}.`,
            data: null
        };
    }

    @AITool({
        name: 'delete_container',
        description: 'Delete a Docker container.',
        parameters: typia.llm.parameters<DeleteContainerInput>(),
        validate: typia.createValidate<DeleteContainerInput>()
    })
    deleteContainer(input: DeleteContainerInput & AIToolScope) {
        return deleteContainer(input.teamId, input.containerId, input.userId);
    }
}
