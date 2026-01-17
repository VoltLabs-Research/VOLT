import { injectable, inject, delay } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { DeleteMessageUseCase } from '@/src/modules/chat/application/use-cases/chat-message/DeleteMessageUseCase';

@injectable()
export default class DeleteMessageController extends BaseController<DeleteMessageUseCase> {
    constructor(
        @inject(delay(() => DeleteMessageUseCase))
        useCase: DeleteMessageUseCase
    ) {
        super(useCase);
    }
};