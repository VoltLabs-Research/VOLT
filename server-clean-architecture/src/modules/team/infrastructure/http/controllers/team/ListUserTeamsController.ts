import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import ListUserTeamsUseCase from '@modules/team/application/use-cases/team/ListUserTeamsUseCase';

@injectable()
export default class ListUserTeamsController extends BaseController<ListUserTeamsUseCase> {
    constructor(
        @inject(ListUserTeamsUseCase) useCase: ListUserTeamsUseCase
    ) {
        super(useCase);
    }
};