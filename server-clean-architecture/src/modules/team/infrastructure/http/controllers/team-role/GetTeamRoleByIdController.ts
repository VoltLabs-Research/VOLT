import { injectable } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import GetTeamRoleByIdUseCase from '@/src/modules/team/application/use-cases/team-role/GetTeamRoleByIdUseCase';

@injectable()
export default class GetTeamRoleByIdController extends BaseController<GetTeamRoleByIdUseCase>{
    constructor(
        useCase: GetTeamRoleByIdUseCase
    ){
        super(useCase);
    }
};