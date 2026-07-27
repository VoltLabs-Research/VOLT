import ChatModel from '@modules/chat/models/chat/ChatModel';
import { deleteManyOnTeamDeleted } from '@shared/application/events/cascadeDeleteHandlerFactories';

deleteManyOnTeamDeleted(ChatModel, { className: 'ChatTeamDeletedEventHandler' });
