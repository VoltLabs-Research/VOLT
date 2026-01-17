import chatMessageRoutes from './routes/chat-message-routes';
import { HttpModule } from '@/src/shared/infrastructure/http/HttpModule';

export const ChatMessageHttpModule: HttpModule = {
    basePath: '/api/chat-messages',
    router: chatMessageRoutes
};
