import { injectable } from 'tsyringe';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { CreateTeamInputDTO } from '@/src/modules/team/application/dtos/team/CreateTeamDTO';
import { HttpStatus } from '@/src/shared/infrastructure/http/HttpStatus';
import CreateTeamUseCase from '@/src/modules/team/application/use-cases/team/CreateTeamUseCase';

@injectable()
export default class CreateTeamController extends BaseController<CreateTeamUseCase>{
    constructor(
        useCase: CreateTeamUseCase
    ){
        super(useCase, HttpStatus.Created);
    }

    protected getParams(req: AuthenticatedRequest): CreateTeamInputDTO{
        const { name, description } = req.body;
        return {
            name,
            description,
            ownerId: req.userId!
        }
    }
};