import type { ChatReactionProps } from '@modules/chat/contracts/chat-message';

/**
 * Drops `userId` from every reaction matching `emoji` (or from all of them when
 * `emoji` is omitted) and prunes reactions left with no users. Returns a new
 * list; the entries it rewrites are fresh objects.
 */
const detachUser = (reactions: ChatReactionProps[], userId: string, emoji?: string): ChatReactionProps[] =>
    reactions
        .map((reaction) => (emoji === undefined || reaction.emoji === emoji
            ? {
                emoji: reaction.emoji,
                users: reaction.users.filter((user) => user !== userId)
            }
            : reaction))
        .filter((reaction) => reaction.users.length > 0);

/** A user holds at most one reaction per message, so setting one clears the rest. */
export const setReaction = (reactions: ChatReactionProps[], userId: string, emoji: string): ChatReactionProps[] => {
    const next = detachUser(reactions, userId);
    const existing = next.find((reaction) => reaction.emoji === emoji);

    if(existing){
        existing.users.push(userId);
        return next;
    }

    return [...next, {
        emoji,
        users: [userId]
    }];
};

export const clearReaction = (reactions: ChatReactionProps[], userId: string, emoji: string): ChatReactionProps[] =>
    detachUser(reactions, userId, emoji);
