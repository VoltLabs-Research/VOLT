import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import GetTeamByIdUseCase from '@/src/modules/team/application/use-cases/team/GetTeamByIdUseCase';

@injectable()
export default class GetTeamByIdController extends BaseController<GetTeamByIdUseCase> {
    constructor(
        @inject(GetTeamByIdUseCase) useCase: GetTeamByIdUseCase
    ) {
        super(useCase);
    }
};