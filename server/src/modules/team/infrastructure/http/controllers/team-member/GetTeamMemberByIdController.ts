import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import GetTeamMemberByIdUseCase from '@modules/team/application/use-cases/team-member/GetTeamMemberByIdUseCase';

@injectable()
export default class GetTeamMemberByIdController extends BaseController<GetTeamMemberByIdUseCase> {
    constructor(
        @inject(GetTeamMemberByIdUseCase) useCase: GetTeamMemberByIdUseCase
    ) {
        super(useCase);
    }
};