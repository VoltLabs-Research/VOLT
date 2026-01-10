import { Response } from 'express';
import { injectable } from 'tsyringe';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';
import { TeamInvitationStatus } from '@/src/modules/team/domain/entities/TeamInvitation';
import BaseResponse from '@/src/shared/infrastructure/http/BaseResponse';
import UpdateTeamInvitationByIdUseCase from '@/src/modules/team/application/use-cases/team-invitation/UpdateTeamInvitationByIdUseCase';

@injectable()
export default class UpdateTeamInvitationByIdController{
    constructor(
        private useCase: UpdateTeamInvitationByIdUseCase
    ){}

    async handle(req: AuthenticatedRequest, res: Response): Promise<void>{
        const status = req.query.status as TeamInvitationStatus;
        const { invitationId } = req.params;
        const result = await this.useCase.execute({ invitationId, status });
        if(!result.success){
            BaseResponse.error(res, result.error.message, result.error.statusCode);
            return;
        }

        BaseResponse.success(res, result.value, 200);
    }
};