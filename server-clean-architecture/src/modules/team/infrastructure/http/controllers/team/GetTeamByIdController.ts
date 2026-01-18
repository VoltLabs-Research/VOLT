import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import GetTeamByIdUseCase from '@modules/team/application/use-cases/team/GetTeamByIdUseCase';

@injectable()
export default class GetTeamByIdController extends BaseController<GetTeamByIdUseCase> {
    constructor(
        @inject(GetTeamByIdUseCase) useCase: GetTeamByIdUseCase
    ) {
        super(useCase);
    }
};