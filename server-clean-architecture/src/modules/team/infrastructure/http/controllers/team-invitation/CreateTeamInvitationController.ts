import { injectable } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { HttpStatus } from '@/src/shared/infrastructure/http/HttpStatus';
import CreateTeamInvitationUseCase from '@/src/modules/team/application/use-cases/team-invitation/CreateTeamInvitationUseCase';

@injectable()
export default class CreateTeamInvitationController extends BaseController<CreateTeamInvitationUseCase>{
    constructor(
        useCase: CreateTeamInvitationUseCase
    ){
        super(useCase, HttpStatus.Created);
    }
};