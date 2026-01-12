import { injectable } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { HttpStatus } from '@/src/shared/infrastructure/http/HttpStatus';
import CreateTeamRoleUseCase from '@/src/modules/team/application/use-cases/team-role/CreateTeamRoleUseCase';

@injectable()
export default class CreateTeamRoleController extends BaseController<CreateTeamRoleUseCase>{
    constructor(
        useCase: CreateTeamRoleUseCase
    ){
        super(useCase, HttpStatus.Created);
    }
};