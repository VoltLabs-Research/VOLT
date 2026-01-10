import { Response } from 'express';
import { injectable } from 'tsyringe';
import BaseResponse from '@/src/shared/infrastructure/http/BaseResponse';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';
import CreateTeamInvitationUseCase from '@/src/modules/team/application/use-cases/team-invitation/CreateTeamInvitationUseCase';

@injectable()
export default class CreateTeamInvitationController{
    constructor(
        private useCase: CreateTeamInvitationUseCase
    ){}

    async handle(req: AuthenticatedRequest, res: Response): Promise<void>{
        const { teamId } = req.params;
        const { invitedBy, invitedUser, email, role } = req.body;
        const result = await this.useCase.execute({ teamId, invitedBy, invitedUser, email, role });
        if(!result.success){
            BaseResponse.error(res, result.error.message, result.error.statusCode);
            return;
        }

        BaseResponse.success(res, result.value, 201);
    }
};