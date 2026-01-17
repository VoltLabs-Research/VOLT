import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { HttpStatus } from '@/src/shared/infrastructure/http/HttpStatus';
import DeleteTeamRoleByIdUseCase from '@/src/modules/team/application/use-cases/team-role/DeleteTeamRoleByIdUseCase';

@injectable()
export default class DeleteTeamRoleByIdController extends BaseController<DeleteTeamRoleByIdUseCase> {
    constructor(
        @inject(DeleteTeamRoleByIdUseCase) useCase: DeleteTeamRoleByIdUseCase
    ) {
        super(useCase, HttpStatus.Deleted);
    }
};