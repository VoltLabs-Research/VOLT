import { injectable, inject, delay } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { ToggleMessageReactionUseCase } from '@modules/chat/application/use-cases/chat-message/ToggleMessageReactionUseCase';

@injectable()
export default class ToggleMessageReactionController extends BaseController<ToggleMessageReactionUseCase> {
    constructor(
        @inject(delay(() => ToggleMessageReactionUseCase))
        useCase: ToggleMessageReactionUseCase
    ) {
        super(useCase);
    }
};