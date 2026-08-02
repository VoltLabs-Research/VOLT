import { ErrorCodes } from '@core/constants/error-codes';
import Chat from '@modules/chat/models/Chat';
import ApplicationError from '@shared/application/errors/ApplicationError';

export const resolveAccessibleChat = async (chatId: string, requesterId: string): Promise<Chat> => {
    const chat = await Chat.findOneBy({ id: chatId });
    if(!chat || !chat.isActive){
        throw ApplicationError.notFound(ErrorCodes.CHAT_NOT_FOUND, 'Chat not found');
    }
    if(!(chat.participants ?? []).includes(requesterId)){
        throw ApplicationError.unauthorized(ErrorCodes.AUTH_UNAUTHORIZED, 'You are not a participant in this chat');
    }
    return chat;
};

export const resolveGroupChat = async (chatId: string, requesterId: string, requireAdmin: boolean): Promise<Chat> => {
    const chat = await resolveAccessibleChat(chatId, requesterId);
    if(!chat.isGroup){
        throw ApplicationError.notFound(ErrorCodes.CHAT_NOT_FOUND, 'Chat not found');
    }
    if(requireAdmin && !(chat.admins ?? []).includes(requesterId)){
        throw ApplicationError.unauthorized(ErrorCodes.AUTH_UNAUTHORIZED, 'Only admins can perform this action');
    }
    return chat;
};
