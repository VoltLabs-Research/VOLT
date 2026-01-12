import { injectable } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { HttpStatus } from '@/src/shared/infrastructure/http/HttpStatus';
import RemoveUserFromTeamUseCase from '@/src/modules/team/application/use-cases/team/RemoveUserFromTeamUseCase';

@injectable()
export default class RemoveUserFromTeamController extends BaseController<RemoveUserFromTeamUseCase>{
    constructor(
        useCase: RemoveUserFromTeamUseCase
    ){
        super(useCase, HttpStatus.Deleted);
    }
};