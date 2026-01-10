import { Response } from 'express';
import { injectable } from 'tsyringe';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';
import ListTeamInvitationsUseCase from '@/src/modules/team/application/use-cases/team-invitation/ListTeamInvitationsUseCase';
import { TeamInvitationStatus } from '@/src/modules/team/domain/entities/TeamInvitation';
import BaseResponse from '@/src/shared/infrastructure/http/BaseResponse';

@injectable()
export default class ListTeamInvitationsByTeamIdController{
    constructor(
        private useCase: ListTeamInvitationsUseCase
    ){}

    async handle(req: AuthenticatedRequest, res: Response): Promise<void>{
        const { teamId } = req.params;
        const status = req.query.status as TeamInvitationStatus;
        const results = await this.useCase.execute({ teamId, status });
        if(!results.success){
            BaseResponse.error(res, results.error.message, results.error.statusCode);
            return;
        }
        BaseResponse.success(res, results.value, 200);
    }
};