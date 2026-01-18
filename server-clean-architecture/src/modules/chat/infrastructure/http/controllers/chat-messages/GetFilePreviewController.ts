import { injectable, inject, delay } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { GetFilePreviewUseCase } from '@modules/chat/application/use-cases/chat-message/GetFilePreviewUseCase';

@injectable()
export default class GetFilePreviewController extends BaseController<GetFilePreviewUseCase> {
    constructor(
        @inject(delay(() => GetFilePreviewUseCase))
        useCase: GetFilePreviewUseCase
    ) {
        super(useCase);
    }
};