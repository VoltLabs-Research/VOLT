import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';
import RemoveUserFromTeamUseCase from '@modules/team/application/use-cases/team/RemoveUserFromTeamUseCase';

@injectable()
export default class RemoveUserFromTeamController extends BaseController<RemoveUserFromTeamUseCase> {
    constructor(
        @inject(RemoveUserFromTeamUseCase) useCase: RemoveUserFromTeamUseCase
    ) {
        super(useCase, HttpStatus.Deleted);
    }
};