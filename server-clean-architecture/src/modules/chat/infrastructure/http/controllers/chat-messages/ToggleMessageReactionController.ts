import { injectable, inject, delay } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { ToggleMessageReactionUseCase } from '@/src/modules/chat/application/use-cases/chat-message/ToggleMessageReactionUseCase';

@injectable()
export default class ToggleMessageReactionController extends BaseController<ToggleMessageReactionUseCase> {
    constructor(
        @inject(delay(() => ToggleMessageReactionUseCase))
        useCase: ToggleMessageReactionUseCase
    ) {
        super(useCase);
    }
};