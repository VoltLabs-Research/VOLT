import AIToolController from '@shared/ai/AIToolController';
import { AITool } from '@shared/ai/tool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ContainerService from '@modules/container/services/ContainerService';
import {
    containerRefSchema,
    createContainerSchema,
    deleteContainerSchema,
    getContainerPortAccessUrlSchema,
    listContainerFilesSchema,
    listContainersSchema,
    moveContainerSchema,
    readContainerFileSchema,
    updateContainerSchema,
    type ContainerRefInput,
    type CreateContainerInput,
    type DeleteContainerInput,
    type GetContainerPortAccessUrlInput,
    type ListContainerFilesInput,
    type ListContainersInput,
    type MoveContainerInput,
    type ReadContainerFileInput,
    type UpdateContainerInput
} from '@volt/contracts/modules/container/ai-tools';

export default class ContainerAIToolController extends AIToolController {
    #service = new ContainerService();

    @AITool({
        name: 'create_container',
        description: 'Create a new Docker container.',
        parameters: createContainerSchema
    })
    createContainer(input: CreateContainerInput & AIToolScope) {
        return this.#service.create(input.teamId, input.userId, input);
    }

    @AITool({
        name: 'list_containers',
        description: 'List all Docker containers in the team.',
        parameters: listContainersSchema
    })
    async listContainers(input: ListContainersInput & AIToolScope) {
        const { total, data } = await this.#service.list(input.teamId, input.userId, input);
        return { summary: `Found ${total} containers.`, data };
    }

    @AITool({
        name: 'get_container_by_id',
        description: 'Get detailed information about a specific container.',
        parameters: containerRefSchema
    })
    getContainerById(input: ContainerRefInput & AIToolScope) {
        return this.#service.getById(input.teamId, input.containerId);
    }

    @AITool({
        name: 'get_container_stats',
        description: 'Get resource usage stats for a container.',
        parameters: containerRefSchema
    })
    getContainerStats(input: ContainerRefInput & AIToolScope) {
        return this.#service.getStats(input.teamId, input.containerId);
    }

    @AITool({
        name: 'get_container_processes',
        description: 'List running processes in a container.',
        parameters: containerRefSchema
    })
    getContainerProcesses(input: ContainerRefInput & AIToolScope) {
        return this.#service.getProcesses(input.teamId, input.containerId);
    }

    @AITool({
        name: 'list_container_files',
        description: 'List files in a container directory.',
        parameters: listContainerFilesSchema
    })
    listContainerFiles(input: ListContainerFilesInput & AIToolScope) {
        return this.#service.getFiles(input.teamId, input.containerId, input.path);
    }

    @AITool({
        name: 'read_container_file',
        description: 'Read a file from a container.',
        parameters: readContainerFileSchema
    })
    readContainerFile(input: ReadContainerFileInput & AIToolScope) {
        return this.#service.readFile(input.teamId, input.containerId, input.path);
    }

    @AITool({
        name: 'get_container_port_access_url',
        description: 'Generate a temporary browser-accessible URL for an exposed port of a running container.',
        parameters: getContainerPortAccessUrlSchema
    })
    async getContainerPortAccessUrl(input: GetContainerPortAccessUrlInput & AIToolScope) {
        const accessUrl = await this.#service.createPortAccessUrl(input.teamId, input.containerId, input.port, input.userId);
        return { summary: `Generated a temporary access URL for port ${input.port}.`, data: accessUrl };
    }

    @AITool({
        name: 'update_container',
        description: 'Update a Docker container.',
        parameters: updateContainerSchema
    })
    updateContainer(input: UpdateContainerInput & AIToolScope) {
        return this.#service.update(input.teamId, input.containerId, {});
    }

    @AITool({
        name: 'move_container',
        description: 'Move a container into a different folder (pass folderId null to move it to the root).',
        parameters: moveContainerSchema,
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
        parameters: deleteContainerSchema
    })
    deleteContainer(input: DeleteContainerInput & AIToolScope) {
        return this.#service.delete(input.teamId, input.containerId, input.userId);
    }
}
