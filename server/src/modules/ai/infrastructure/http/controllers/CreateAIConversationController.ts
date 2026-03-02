import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';
import CreateAIConversationUseCase from '@modules/ai/application/use-cases/CreateAIConversationUseCase';

@injectable()
export default class CreateAIConversationController extends BaseController<CreateAIConversationUseCase> {
    constructor(
        @inject(CreateAIConversationUseCase)
        useCase: CreateAIConversationUseCase
    ) {
        super(useCase, HttpStatus.Created);
    }
}
