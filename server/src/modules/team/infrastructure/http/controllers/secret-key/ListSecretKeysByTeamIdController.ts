import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import ListSecretKeysByTeamIdUseCase from '@modules/team/application/use-cases/secret-key/ListSecretKeysByTeamIdUseCase';

@injectable()
export default class ListSecretKeysByTeamIdController extends BaseController<ListSecretKeysByTeamIdUseCase> {
    constructor(
        @inject(ListSecretKeysByTeamIdUseCase)
        useCase: ListSecretKeysByTeamIdUseCase
    ) {
        super(useCase);
    }
}
