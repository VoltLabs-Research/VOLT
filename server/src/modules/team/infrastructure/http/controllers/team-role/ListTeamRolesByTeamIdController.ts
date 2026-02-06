import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import ListTeamRolesByTeamIdUseCase from '@modules/team/application/use-cases/team-role/ListTeamRolesByTeamIdUseCase';

@injectable()
export default class ListTeamRolesByTeamIdController extends BaseController<ListTeamRolesByTeamIdUseCase> {
    constructor(
        @inject(ListTeamRolesByTeamIdUseCase) useCase: ListTeamRolesByTeamIdUseCase
    ) {
        super(useCase);
    }
};