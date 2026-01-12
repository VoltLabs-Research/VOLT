import { injectable } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import DeleteMessageUseCase from '@/src/modules/chat/application/use-cases/chat-message/DeleteMessageUseCase';

@injectable()
export default class DeleteMessageController extends BaseController<DeleteMessageUseCase>{
    constructor(
        useCase: DeleteMessageUseCase
    ){
        super(useCase);
    }
};