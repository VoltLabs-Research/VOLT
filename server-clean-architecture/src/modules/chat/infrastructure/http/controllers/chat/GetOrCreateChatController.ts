import { injectable, inject, delay } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { GetOrCreateChatUseCase } from '@modules/chat/application/use-cases/chat/GetOrCreateChatUseCase';

@injectable()
export default class GetOrCreateChatController extends BaseController<GetOrCreateChatUseCase> {
    constructor(
        @inject(delay(() => GetOrCreateChatUseCase))
        useCase: GetOrCreateChatUseCase
    ) {
        super(useCase);
    }
};