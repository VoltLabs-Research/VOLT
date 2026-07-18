import Chat, { ChatParticipant } from '@modules/chat/entities/chat/Chat';

export function isParticipant(chat: Chat, userId: string): boolean {
    return chat.props.participants.some((participant: ChatParticipant) => {
        if (typeof participant === 'string') {
            return participant === userId;
        }

        const participantId = participant._id?.toString() || participant.toString();
        return participantId === userId;
    });
}
