import { injectable } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import GetTeamInvitationByIdUseCase from '@/src/modules/team/application/use-cases/team-invitation/GetTeamInvitationByIdUseCase';

@injectable()
export default class GetTeamInvitationByIdController extends BaseController<GetTeamInvitationByIdUseCase>{
    constructor(
        useCase: GetTeamInvitationByIdUseCase
    ){
        super(useCase);
    }
};