import { injectable } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import GetChatMessagesUseCase from '@/src/modules/chat/application/use-cases/chat-message/GetChatMessagesUseCase';

@injectable()
export default class GetChatMessagesController extends BaseController<GetChatMessagesUseCase>{
    constructor(
        useCase: GetChatMessagesUseCase
    ){
        super(useCase)
    };
};