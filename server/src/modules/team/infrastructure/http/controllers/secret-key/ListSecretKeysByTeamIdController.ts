import { injectable, inject } from 'tsyringe';
import { PaginatedBaseController } from '@shared/infrastructure/http/PaginatedBaseController';
import ListSecretKeysByTeamIdUseCase from '@modules/team/application/use-cases/secret-key/ListSecretKeysByTeamIdUseCase';

@injectable()
export default class ListSecretKeysByTeamIdController extends PaginatedBaseController<ListSecretKeysByTeamIdUseCase> {
    constructor(
        @inject(ListSecretKeysByTeamIdUseCase)
        useCase: ListSecretKeysByTeamIdUseCase
    ) {
        super(useCase);
    }
}
