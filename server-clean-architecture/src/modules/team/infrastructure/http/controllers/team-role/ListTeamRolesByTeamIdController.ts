import { injectable } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import ListTeamRolesByTeamIdUseCase from '@/src/modules/team/application/use-cases/team-role/ListTeamRolesByTeamIdUseCase';

@injectable()
export default class ListTeamRolesByTeamIdController extends BaseController<ListTeamRolesByTeamIdUseCase>{
    constructor(
        useCase: ListTeamRolesByTeamIdUseCase
    ){
        super(useCase);
    }
};