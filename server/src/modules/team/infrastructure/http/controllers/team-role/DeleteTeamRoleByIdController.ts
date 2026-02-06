import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';
import DeleteTeamRoleByIdUseCase from '@modules/team/application/use-cases/team-role/DeleteTeamRoleByIdUseCase';

@injectable()
export default class DeleteTeamRoleByIdController extends BaseController<DeleteTeamRoleByIdUseCase> {
    constructor(
        @inject(DeleteTeamRoleByIdUseCase) useCase: DeleteTeamRoleByIdUseCase
    ) {
        super(useCase, HttpStatus.Deleted);
    }
};