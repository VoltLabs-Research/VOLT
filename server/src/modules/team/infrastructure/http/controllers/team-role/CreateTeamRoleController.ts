import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';
import CreateTeamRoleUseCase from '@modules/team/application/use-cases/team-role/CreateTeamRoleUseCase';

@injectable()
export default class CreateTeamRoleController extends BaseController<CreateTeamRoleUseCase> {
    constructor(
        @inject(CreateTeamRoleUseCase) useCase: CreateTeamRoleUseCase
    ) {
        super(useCase, HttpStatus.Created);
    }
};