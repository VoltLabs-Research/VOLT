import type { CreateContainerInputDTO, CreateContainerOutputDTO } from '@modules/container/application/dtos/CreateContainerDTO';
import type { DeleteContainerInputDTO, DeleteContainerOutputDTO } from '@modules/container/application/dtos/DeleteContainerDTO';
import type {
    CreateContainerPortAccessUrlInputDTO,
    CreateContainerPortAccessUrlOutputDTO,
    GetContainerByIdInputDTO,
    GetContainerByIdOutputDTO
} from '@modules/container/application/dtos/GetContainerByIdDTO';
import type { GetContainerFilesInputDTO, GetContainerFilesOutputDTO } from '@modules/container/application/dtos/GetContainerFilesDTO';
import type { GetContainerProcessesInputDTO, GetContainerProcessesOutputDTO } from '@modules/container/application/dtos/GetContainerProcessesDTO';
import type { GetContainerStatsInputDTO, GetContainerStatsOutputDTO } from '@modules/container/application/dtos/GetContainerStatsDTO';
import type { ListContainersInputDTO, ListContainersOutputDTO } from '@modules/container/application/dtos/ListContainersDTO';
import type { MoveContainerInputDTO, MoveContainerOutputDTO } from '@modules/container/application/dtos/MoveContainerDTO';
import type { ReadContainerFileInputDTO, ReadContainerFileOutputDTO } from '@modules/container/application/dtos/ReadContainerFileDTO';
import type { UpdateContainerInputDTO, UpdateContainerOutputDTO } from '@modules/container/application/dtos/UpdateContainerDTO';
import { CreateContainerUseCase } from '@modules/container/application/use-cases/CreateContainerUseCase';
import { CreateContainerPortAccessUrlUseCase } from '@modules/container/application/use-cases/CreateContainerPortAccessUrlUseCase';
import { DeleteContainerUseCase } from '@modules/container/application/use-cases/DeleteContainerUseCase';
import { GetContainerByIdUseCase } from '@modules/container/application/use-cases/GetContainerByIdUseCase';
import { GetContainerFilesUseCase } from '@modules/container/application/use-cases/GetContainerFilesUseCase';
import { GetContainerProcessesUseCase } from '@modules/container/application/use-cases/GetContainerProcessesUseCase';
import { GetContainerStatsUseCase } from '@modules/container/application/use-cases/GetContainerStatsUseCase';
import { ListContainersUseCase } from '@modules/container/application/use-cases/ListContainersUseCase';
import { MoveContainerUseCase } from '@modules/container/application/use-cases/MoveContainerUseCase';
import { ReadContainerFileUseCase } from '@modules/container/application/use-cases/ReadContainerFileUseCase';
import { UpdateContainerUseCase } from '@modules/container/application/use-cases/UpdateContainerUseCase';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

/**
 * The single application service for the container module. Each method is a thin
 * delegator to the retained use case (every container use case is still consumed
 * by an AI tool, an event handler, or the shared catalog-folder route factory),
 * unwrapping the Result error channel to thrown `ApplicationError`s so Express 5
 * forwards them to the global error middleware. Mirrors the auth module's
 * `updateAccount` / notification module's `getMyNotifications` delegators.
 *
 * Only the HTTP-facing operations live here; the exec / port-proxy / session /
 * relay infrastructure is untouched.
 */
@Singleton(CONTAINER_TOKENS.ContainerService)
export default class ContainerService {
    constructor(
        @inject(CreateContainerUseCase) private readonly createContainerUseCase: CreateContainerUseCase,
        @inject(ListContainersUseCase) private readonly listContainersUseCase: ListContainersUseCase,
        @inject(GetContainerByIdUseCase) private readonly getContainerByIdUseCase: GetContainerByIdUseCase,
        @inject(UpdateContainerUseCase) private readonly updateContainerUseCase: UpdateContainerUseCase,
        @inject(DeleteContainerUseCase) private readonly deleteContainerUseCase: DeleteContainerUseCase,
        @inject(CreateContainerPortAccessUrlUseCase) private readonly createContainerPortAccessUrlUseCase: CreateContainerPortAccessUrlUseCase,
        @inject(MoveContainerUseCase) private readonly moveContainerUseCase: MoveContainerUseCase,
        @inject(GetContainerFilesUseCase) private readonly getContainerFilesUseCase: GetContainerFilesUseCase,
        @inject(GetContainerProcessesUseCase) private readonly getContainerProcessesUseCase: GetContainerProcessesUseCase,
        @inject(GetContainerStatsUseCase) private readonly getContainerStatsUseCase: GetContainerStatsUseCase,
        @inject(ReadContainerFileUseCase) private readonly readContainerFileUseCase: ReadContainerFileUseCase
    ) {}

    async create(input: CreateContainerInputDTO): Promise<CreateContainerOutputDTO> {
        const result = await this.createContainerUseCase.execute(input);
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }

    async list(input: ListContainersInputDTO): Promise<ListContainersOutputDTO> {
        const result = await this.listContainersUseCase.execute(input);
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }

    async getById(input: GetContainerByIdInputDTO): Promise<GetContainerByIdOutputDTO> {
        const result = await this.getContainerByIdUseCase.execute(input);
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }

    async update(input: UpdateContainerInputDTO): Promise<UpdateContainerOutputDTO> {
        const result = await this.updateContainerUseCase.execute(input);
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }

    async delete(input: DeleteContainerInputDTO): Promise<DeleteContainerOutputDTO> {
        const result = await this.deleteContainerUseCase.execute(input);
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }

    async createPortAccessUrl(input: CreateContainerPortAccessUrlInputDTO): Promise<CreateContainerPortAccessUrlOutputDTO> {
        const result = await this.createContainerPortAccessUrlUseCase.execute(input);
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }

    async move(input: MoveContainerInputDTO): Promise<MoveContainerOutputDTO> {
        const result = await this.moveContainerUseCase.execute(input);
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }

    async getFiles(input: GetContainerFilesInputDTO): Promise<GetContainerFilesOutputDTO> {
        const result = await this.getContainerFilesUseCase.execute(input);
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }

    async getProcesses(input: GetContainerProcessesInputDTO): Promise<GetContainerProcessesOutputDTO> {
        const result = await this.getContainerProcessesUseCase.execute(input);
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }

    async getStats(input: GetContainerStatsInputDTO): Promise<GetContainerStatsOutputDTO> {
        const result = await this.getContainerStatsUseCase.execute(input);
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }

    async readFile(input: ReadContainerFileInputDTO): Promise<ReadContainerFileOutputDTO> {
        const result = await this.readContainerFileUseCase.execute(input);
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }
}
