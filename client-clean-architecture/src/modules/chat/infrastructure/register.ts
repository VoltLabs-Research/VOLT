import { registerChatDependencies } from '../application/registry';
import { chatRepository } from './repositories/ChatRepository';
import { socketService } from '@/shared/infrastructure/services/SocketIOService';

export const registerChatInfrastructure = (): void => {
    registerChatDependencies({
        chatRepository,
        socketService
    });
};
