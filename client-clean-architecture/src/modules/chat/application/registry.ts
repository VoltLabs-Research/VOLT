import type { IChatRepository } from '../domain/repositories/IChatRepository';
import type { ISocketService } from '@/shared/domain/repositories/ISocketService';
import {
    ChatSocketUseCase,
    GetChatFilePreviewUseCase,
    GetChatMessagesUseCase,
    GetChatsUseCase,
    SendMessageUseCase
} from './use-cases';

export interface ChatDependencies {
    chatRepository: IChatRepository;
    socketService: ISocketService;
}

export interface ChatUseCases {
    getChatsUseCase: GetChatsUseCase;
    getChatMessagesUseCase: GetChatMessagesUseCase;
    sendMessageUseCase: SendMessageUseCase;
    getChatFilePreviewUseCase: GetChatFilePreviewUseCase;
    chatSocketUseCase: ChatSocketUseCase;
    chatRepository: IChatRepository;
    socketService: ISocketService;
}

let dependencies: ChatDependencies | null = null;
let useCases: ChatUseCases | null = null;

const buildUseCases = (deps: ChatDependencies): ChatUseCases => ({
    getChatsUseCase: new GetChatsUseCase(deps.chatRepository),
    getChatMessagesUseCase: new GetChatMessagesUseCase(deps.chatRepository),
    sendMessageUseCase: new SendMessageUseCase(deps.chatRepository),
    getChatFilePreviewUseCase: new GetChatFilePreviewUseCase(deps.chatRepository),
    chatSocketUseCase: new ChatSocketUseCase(deps.socketService),
    chatRepository: deps.chatRepository,
    socketService: deps.socketService
});

export const registerChatDependencies = (deps: ChatDependencies): void => {
    dependencies = deps;
    useCases = null;
};

export const getChatUseCases = (): ChatUseCases => {
    if (!dependencies) {
        throw new Error('Chat dependencies not registered');
    }

    if (!useCases) {
        useCases = buildUseCases(dependencies);
    }

    return useCases;
};
