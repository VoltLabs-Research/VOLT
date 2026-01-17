import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import GetTeamRoleByIdUseCase from '@/src/modules/team/application/use-cases/team-role/GetTeamRoleByIdUseCase';

@injectable()
export default class GetTeamRoleByIdController extends BaseController<GetTeamRoleByIdUseCase> {
    constructor(
        @inject(GetTeamRoleByIdUseCase) useCase: GetTeamRoleByIdUseCase
    ) {
        super(useCase);
    }
};