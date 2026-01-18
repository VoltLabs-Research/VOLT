import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';
import DeleteTeamMemberByIdUseCase from '@modules/team/application/use-cases/team-member/DeleteTeamMemberByIdUseCase';

@injectable()
export default class DeleteTeamMemberByIdController extends BaseController<DeleteTeamMemberByIdUseCase> {
    constructor(
        @inject(DeleteTeamMemberByIdUseCase) useCase: DeleteTeamMemberByIdUseCase
    ) {
        super(useCase, HttpStatus.Deleted);
    }
};