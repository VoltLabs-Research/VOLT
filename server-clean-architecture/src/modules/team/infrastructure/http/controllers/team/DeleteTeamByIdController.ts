import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { HttpStatus } from '@/src/shared/infrastructure/http/HttpStatus';
import DeleteTeamByIdUseCase from '@/src/modules/team/application/use-cases/team/DeleteTeamByIdUseCase';

@injectable()
export default class DeleteTeamByIdController extends BaseController<DeleteTeamByIdUseCase> {
    constructor(
        @inject(DeleteTeamByIdUseCase) useCase: DeleteTeamByIdUseCase
    ) {
        super(useCase, HttpStatus.Deleted);
    }
};