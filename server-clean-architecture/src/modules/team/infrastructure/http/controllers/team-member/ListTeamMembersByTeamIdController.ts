import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import ListTeamMembersByTeamIdUseCase from '@modules/team/application/use-cases/team-member/ListTeamMembersByTeamIdUseCase';

@injectable()
export default class ListTeamMembersByTeamIdController extends BaseController<ListTeamMembersByTeamIdUseCase> {
    constructor(
        @inject(ListTeamMembersByTeamIdUseCase) useCase: ListTeamMembersByTeamIdUseCase
    ) {
        super(useCase);
    }
};