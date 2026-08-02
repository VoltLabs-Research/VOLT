import type { ChatReaction } from '@volt/contracts/modules/chat/domain';

export const COMMON_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

export const hasUserReacted = (reaction: ChatReaction, currentUserId?: string): boolean => {
    if (!currentUserId) return false;

    return reaction.users.some((user) => (typeof user === 'string' ? user : user._id) === currentUserId);
};

export const hasUserReactedWith = (
    reactions: ChatReaction[] | undefined,
    emoji: string,
    currentUserId?: string
): boolean => {
    const reaction = reactions?.find((candidate) => candidate.emoji === emoji);

    return !!reaction && hasUserReacted(reaction, currentUserId);
};
