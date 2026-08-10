import UserInfo from '@/modules/auth/components/UserInfo';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { useTeamPresenceStore } from '@/modules/team/store/team/use-team-presence-store';
import { resolveTeamUserOnline } from '@/modules/team/utils/member/presence';
import type { User } from '@volt/contracts/modules/auth/domain';
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
        return <span className='text-sm text-muted'>{fallback}</span>;
    }

    const isCurrentUser = showCurrentUserSuffix && currentUser?._id === user._id;
    const suffix = isCurrentUser
        ? <span className='text-muted'>(You)</span>
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
