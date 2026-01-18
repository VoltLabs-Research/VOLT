import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import GetTeamRoleByIdUseCase from '@modules/team/application/use-cases/team-role/GetTeamRoleByIdUseCase';

@injectable()
export default class GetTeamRoleByIdController extends BaseController<GetTeamRoleByIdUseCase> {
    constructor(
        @inject(GetTeamRoleByIdUseCase) useCase: GetTeamRoleByIdUseCase
    ) {
        super(useCase);
    }
};