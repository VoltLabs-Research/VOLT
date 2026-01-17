import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import UpdateTeamByIdUseCase from '@/src/modules/team/application/use-cases/team/UpdateTeamByIdUseCase';

@injectable()
export default class UpdateTeamByIdController extends BaseController<UpdateTeamByIdUseCase> {
    constructor(
        @inject(UpdateTeamByIdUseCase) useCase: UpdateTeamByIdUseCase
    ) {
        super(useCase);
    }
};