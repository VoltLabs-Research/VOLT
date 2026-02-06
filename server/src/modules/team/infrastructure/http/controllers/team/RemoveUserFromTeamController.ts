import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';
import RemoveUserFromTeamUseCase from '@modules/team/application/use-cases/team/RemoveUserFromTeamUseCase';

import { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import { RemoveUserFromTeamInputDTO } from '@modules/team/application/dtos/team/RemoveUserFromTeamDTO';

@injectable()
export default class RemoveUserFromTeamController extends BaseController<RemoveUserFromTeamUseCase> {
    constructor(
        @inject(RemoveUserFromTeamUseCase) useCase: RemoveUserFromTeamUseCase
    ) {
        super(useCase, HttpStatus.Deleted);
    }
    protected getParams(req: AuthenticatedRequest): RemoveUserFromTeamInputDTO {
        return {
            teamId: req.params.teamId as string,
            toRemoveUserId: req.body.userId
        };
    }
};