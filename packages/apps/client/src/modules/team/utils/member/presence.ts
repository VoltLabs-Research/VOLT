import type { User } from '@volt/contracts/modules/auth/domain';

export const resolveTeamUserOnline = (
    user: Pick<User, '_id' | 'isOnline'>,
    onlineUserIds: Set<string>,
    hasPresenceSnapshot: boolean
): boolean => {
    if (hasPresenceSnapshot) {
        return onlineUserIds.has(user._id);
    }

    return user.isOnline === true;
};
