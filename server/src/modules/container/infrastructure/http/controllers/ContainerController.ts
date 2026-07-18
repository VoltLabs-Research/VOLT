import type ContainerService from '@modules/container/application/ContainerService';
import type { CreateContainerInputDTO } from '@modules/container/application/dtos/CreateContainerDTO';
import type { DeleteContainerInputDTO } from '@modules/container/application/dtos/DeleteContainerDTO';
import type {
    CreateContainerPortAccessUrlInputDTO,
    GetContainerByIdInputDTO
} from '@modules/container/application/dtos/GetContainerByIdDTO';
import type { GetContainerFilesInputDTO } from '@modules/container/application/dtos/GetContainerFilesDTO';
import type { GetContainerProcessesInputDTO } from '@modules/container/application/dtos/GetContainerProcessesDTO';
import type { GetContainerStatsInputDTO } from '@modules/container/application/dtos/GetContainerStatsDTO';
import type { ListContainersInputDTO } from '@modules/container/application/dtos/ListContainersDTO';
import type { MoveContainerInputDTO } from '@modules/container/application/dtos/MoveContainerDTO';
import type { ReadContainerFileInputDTO } from '@modules/container/application/dtos/ReadContainerFileDTO';
import type { UpdateContainerInputDTO } from '@modules/container/application/dtos/UpdateContainerDTO';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { buildControllerParams } from '@shared/infrastructure/http/controllers/controller-internals';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import { inject, injectable } from 'tsyringe';
import type { Response } from 'express';

/**
 * The single HTTP controller for the container module. One Express handler per
 * route, assembling the use-case input exactly as `buildControllerParams` did
 * for the generated controllers, delegating to {@link ContainerService}, and
 * responding via {@link BaseResponse}. Handlers are arrow-function properties so
 * `this` stays bound when passed by reference to the router. Thrown
 * `ApplicationError`s propagate to `httpErrorMiddleware` via Express 5 async
 * forwarding. Per-endpoint status codes and the paginated list variant are
 * preserved verbatim from the previous generated controllers.
 */
@injectable()
export default class ContainerController {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerService) private readonly containerService: ContainerService
    ) {}

    create = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as CreateContainerInputDTO;
        const value = await this.containerService.create(input);
        BaseResponse.success(res, value, HttpStatus.Created);
    };

    listByTeamId = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as ListContainersInputDTO;
        const value = await this.containerService.list(input);
        BaseResponse.paginated(res, value, value._meta);
    };

    getById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetContainerByIdInputDTO;
        const value = await this.containerService.getById(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    updateById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as UpdateContainerInputDTO;
        const value = await this.containerService.update(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    deleteById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as DeleteContainerInputDTO;
        await this.containerService.delete(input);
        // Preserves the generated controller's NoContent behaviour: empty body.
        res.status(HttpStatus.NoContent).send();
    };

    createPortAccessUrl = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as CreateContainerPortAccessUrlInputDTO;
        const value = await this.containerService.createPortAccessUrl(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    move = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as MoveContainerInputDTO;
        const value = await this.containerService.move(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    getFilesById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetContainerFilesInputDTO;
        const value = await this.containerService.getFiles(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    getProcessesById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetContainerProcessesInputDTO;
        const value = await this.containerService.getProcesses(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    getStatsById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetContainerStatsInputDTO;
        const value = await this.containerService.getStats(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    readFileById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as ReadContainerFileInputDTO;
        const value = await this.containerService.readFile(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };
}
