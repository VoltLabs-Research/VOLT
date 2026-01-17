import { injectable, inject, delay } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { MarkMessagesAsReadUseCase } from '@/src/modules/chat/application/use-cases/chat-message/MarkMessageAsReadUseCase';

@injectable()
export default class MarkMessagesAsReadController extends BaseController<MarkMessagesAsReadUseCase> {
    constructor(
        @inject(delay(() => MarkMessagesAsReadUseCase))
        useCase: MarkMessagesAsReadUseCase
    ) {
        super(useCase);
    }
};