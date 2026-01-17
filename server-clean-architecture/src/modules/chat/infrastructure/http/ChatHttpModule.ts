import chatRoutes from './routes/chat-routes';
import { HttpModule } from '@/src/shared/infrastructure/http/HttpModule';

export const ChatHttpModule: HttpModule = {
    basePath: '/api/chats',
    router: chatRoutes
};
