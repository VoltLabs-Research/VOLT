import { Response } from 'express';
import { injectable } from 'tsyringe';
import BaseResponse from '@/src/shared/infrastructure/http/BaseResponse';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';
import GetTeamInvitationByIdUseCase from '@/src/modules/team/application/use-cases/team-invitation/GetTeamInvitationByIdUseCase';

@injectable()
export default class GetTeamInvitationByIdController{
    constructor(
        private useCase: GetTeamInvitationByIdUseCase
    ){}

    async handle(req: AuthenticatedRequest, res: Response): Promise<void>{
        const { invitationId } = req.params;
        const result = await this.useCase.execute({ invitationId });
        if(!result.success){
            BaseResponse.error(res, result.error.message, result.error.statusCode);
            return;
        }
        BaseResponse.success(res, result.value, 200);
    }
};