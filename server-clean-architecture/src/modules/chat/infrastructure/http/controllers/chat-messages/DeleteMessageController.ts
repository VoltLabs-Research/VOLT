import { injectable, inject, delay } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { DeleteMessageUseCase } from '@modules/chat/application/use-cases/chat-message/DeleteMessageUseCase';

@injectable()
export default class DeleteMessageController extends BaseController<DeleteMessageUseCase> {
    constructor(
        @inject(delay(() => DeleteMessageUseCase))
        useCase: DeleteMessageUseCase
    ) {
        super(useCase);
    }
};