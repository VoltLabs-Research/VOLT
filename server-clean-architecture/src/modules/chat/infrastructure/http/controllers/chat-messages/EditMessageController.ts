import { injectable, inject, delay } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { EditMessageUseCase } from '@/src/modules/chat/application/use-cases/chat-message/EditMessageUseCase';

@injectable()
export default class EditMessageController extends BaseController<EditMessageUseCase> {
    constructor(
        @inject(delay(() => EditMessageUseCase))
        useCase: EditMessageUseCase
    ) {
        super(useCase);
    }
}