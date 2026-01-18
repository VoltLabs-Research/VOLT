import { injectable, inject, delay } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { RemoveUsersFromGroupUseCase } from '@modules/chat/application/use-cases/chat/RemoveUsersFromGroupUseCase';

@injectable()
export default class RemoveUsersFromGroupController extends BaseController<RemoveUsersFromGroupUseCase> {
    constructor(
        @inject(delay(() => RemoveUsersFromGroupUseCase))
        useCase: RemoveUsersFromGroupUseCase
    ) {
        super(useCase);
    }
};