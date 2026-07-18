import ChatRepository from '@modules/chat/repositories/chat/ChatRepository';
import { deleteManyOnTeamDeleted } from '@shared/application/events/cascadeDeleteHandlerFactories';

deleteManyOnTeamDeleted(ChatRepository);
