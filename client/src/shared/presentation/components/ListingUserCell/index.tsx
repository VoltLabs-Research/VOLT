import UserInfo from '@/modules/auth/components/UserInfo';
import { Text } from '@voltstack/bravais';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { useTeamPresenceStore } from '@/modules/team/stores/team/use-team-presence-store';
import { resolveTeamUserOnline } from '@/modules/team/utilities/member/presence';
import type { User } from '@/modules/auth/api/entities/user';
import type { ReactNode } from 'react';

interface ListingUserCellProps {
    user?: User | null;
    showStatus?: boolean;
    showCurrentUserSuffix?: boolean;
    fallback?: ReactNode;
};

const ListingUserCell = ({
    user,
    showStatus = false,
    showCurrentUserSuffix = false,
    fallback = '-'
}: ListingUserCellProps) => {
    const currentUser = useCurrentUser();
    const onlineUserIds = useTeamPresenceStore((state) => state.onlineUserIds);
    const hasPresenceSnapshot = useTeamPresenceStore((state) => state.hasPresenceSnapshot);

    if (!user) {
        return <Text size='md' tone='muted'>{fallback}</Text>;
    }

    const isCurrentUser = showCurrentUserSuffix && currentUser?._id === user._id;
    const suffix = isCurrentUser
        ? <Text tone='secondary'>(You)</Text>
        : undefined;
    const isOnline = showStatus
        ? resolveTeamUserOnline(user, onlineUserIds, hasPresenceSnapshot)
        : false;

    return (
        <UserInfo
            user={user}
            showStatus={showStatus}
            isOnline={isOnline}
            suffix={suffix}
        />
    );
};

export default ListingUserCell;
