import { injectable, inject, delay } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { AddUsersToGroupUseCase } from '@modules/chat/application/use-cases/chat/AddUsersToGroupUseCase';

@injectable()
export default class AddUsersToGroupController extends BaseController<AddUsersToGroupUseCase> {
    constructor(
        @inject(delay(() => AddUsersToGroupUseCase))
        useCase: AddUsersToGroupUseCase
    ) {
        super(useCase);
    }
};