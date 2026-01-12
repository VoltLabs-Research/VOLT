import { injectable } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { HttpStatus } from '@/src/shared/infrastructure/http/HttpStatus';
import DeleteTeamRoleByIdUseCase from '@/src/modules/team/application/use-cases/team-role/DeleteTeamRoleByIdUseCase';

@injectable()
export default class DeleteTeamRoleByIdController extends BaseController<DeleteTeamRoleByIdUseCase>{
    constructor(
        useCase: DeleteTeamRoleByIdUseCase
    ){
        super(useCase, HttpStatus.Deleted);
    }
};