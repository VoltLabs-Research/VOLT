import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import GetMyTeamPermissionsUseCase from '@modules/team/application/use-cases/team/GetMyTeamPermissionsUseCase';

@injectable()
export default class GetMyTeamPermissionsController extends BaseController<GetMyTeamPermissionsUseCase> {
    constructor(
        @inject(GetMyTeamPermissionsUseCase) useCase: GetMyTeamPermissionsUseCase
    ) {
        super(useCase);
    }
}
