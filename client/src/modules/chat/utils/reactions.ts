import type { ChatReaction } from '@volt/contracts/modules/chat/domain';

export const COMMON_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

export const hasUserReacted = (reaction: ChatReaction, currentUserId?: string): boolean => {
    if (!currentUserId) return false;

    return reaction.users.some((user) => {
        let userId = user;

        if (typeof user !== 'string') {
            userId = user._id;
        }

        return userId === currentUserId;
    });
};

export const hasUserReactedWith = (
    reactions: ChatReaction[] | undefined,
    emoji: string,
    currentUserId?: string
): boolean => {
    const reaction = reactions?.find((candidate) => candidate.emoji === emoji);
    if (!reaction) return false;

    return hasUserReacted(reaction, currentUserId);
};
