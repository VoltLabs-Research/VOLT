import { injectable, inject, delay } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { EditMessageUseCase } from '@modules/chat/application/use-cases/chat-message/EditMessageUseCase';

@injectable()
export default class EditMessageController extends BaseController<EditMessageUseCase> {
    constructor(
        @inject(delay(() => EditMessageUseCase))
        useCase: EditMessageUseCase
    ) {
        super(useCase);
    }
}