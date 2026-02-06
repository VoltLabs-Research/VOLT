import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import UpdateTeamMemberByIdUseCase from '@modules/team/application/use-cases/team-member/UpdateTeamMemberByIdUseCase';

@injectable()
export default class UpdateTeamMemberByIdController extends BaseController<UpdateTeamMemberByIdUseCase> {
    constructor(
        @inject(UpdateTeamMemberByIdUseCase) useCase: UpdateTeamMemberByIdUseCase
    ) {
        super(useCase);
    }
};