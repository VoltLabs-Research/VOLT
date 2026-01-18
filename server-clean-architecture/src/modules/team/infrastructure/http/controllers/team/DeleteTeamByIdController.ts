import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';
import DeleteTeamByIdUseCase from '@modules/team/application/use-cases/team/DeleteTeamByIdUseCase';

@injectable()
export default class DeleteTeamByIdController extends BaseController<DeleteTeamByIdUseCase> {
    constructor(
        @inject(DeleteTeamByIdUseCase) useCase: DeleteTeamByIdUseCase
    ) {
        super(useCase, HttpStatus.Deleted);
    }
};