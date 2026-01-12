import { injectable } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import UpdateTeamRoleByIdUseCase from '@/src/modules/team/application/use-cases/team-role/UpdateTeamRoleByIdUseCase';

@injectable()
export default class UpdateTeamRoleByIdController extends BaseController<UpdateTeamRoleByIdUseCase>{
    constructor(
        useCase: UpdateTeamRoleByIdUseCase
    ){
        super(useCase);
    }
};