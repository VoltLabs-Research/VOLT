import { injectable, inject } from 'tsyringe';
import { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { CreateTeamInputDTO } from '@modules/team/application/dtos/team/CreateTeamDTO';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';
import CreateTeamUseCase from '@modules/team/application/use-cases/team/CreateTeamUseCase';

@injectable()
export default class CreateTeamController extends BaseController<CreateTeamUseCase> {
    constructor(
        @inject(CreateTeamUseCase) useCase: CreateTeamUseCase
    ) {
        super(useCase, HttpStatus.Created);
    }

    protected getParams(req: AuthenticatedRequest): CreateTeamInputDTO {
        const { name, description } = req.body;
        return {
            name,
            description,
            ownerId: req.userId!
        }
    }
};