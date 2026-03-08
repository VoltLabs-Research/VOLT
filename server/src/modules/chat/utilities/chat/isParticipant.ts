import Chat, { ChatParticipant } from '@modules/chat/domain/entities/chat/Chat';

export function isParticipant(chat: Chat, userId: string): boolean {
    const participants = chat.props.participants || [];

    return participants.some((participant: ChatParticipant) => {
        if (typeof participant === 'string') {
            return participant === userId;
        }

        const participantId = participant._id?.toString() || participant.toString();
        return participantId === userId;
    });
}
