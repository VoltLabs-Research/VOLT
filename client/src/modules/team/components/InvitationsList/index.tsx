import { InvitationRow } from '../InvitationRow';
import { EmptyStateRoot } from '@heroui/react';
import { useId } from 'react';
import type { TeamInvitation } from '@volt/contracts/modules/team/domain';

interface InvitationsListProps {
    invitations: TeamInvitation[];
    isLoading: boolean;
    cancelingId: string | null;
    onCancelInvitation: (id: string) => void;
}

export const InvitationsList = ({
    invitations,
    isLoading,
    cancelingId,
    onCancelInvitation
}: InvitationsListProps) => {
    const emptyHeadingId = useId();

    if(isLoading) {
        return (
            <div className='flex items-center justify-center p-2 min-h-[100px]'>
                <p className='text-sm text-muted text-center p-4'>
                    Loading invitations...
                </p>
            </div>
        );
    }

    if(invitations.length === 0) {
        /*
         * bravais's `EmptyState` with no icon and no action, restated on HeroUI's
         * `EmptyStateRoot` the way `RecoveryState` does — the `<section
         * aria-labelledby>` landmark, the `max-w-[320px]` content column and its
         * `max-md:max-w-[90%]` are all `EmptyState.css`. `w-max` is deliberate: the
         * root class list really did carry Tailwind's `width: max-content`, and
         * `.invitation-list-empty`'s `height: auto` / `padding: 2rem` overrode the
         * container's own `height: 100%`.
         */
        return (
            <EmptyStateRoot<'section'>
                render={(props) => <section {...props} />}
                aria-labelledby={emptyHeadingId}
                className='flex flex-col items-center justify-center w-max h-auto p-8'
            >
                <div className='flex flex-col items-center gap-6 text-center max-w-[320px] max-md:max-w-[90%]'>
                    <div className='flex flex-col gap-2 text-center'>
                        <h2 id={emptyHeadingId} className='text-base font-medium text-foreground'>
                            No Invitations
                        </h2>
                        <span className='text-sm text-muted leading-normal'>
                            No pending invitations
                        </span>
                    </div>
                </div>
            </EmptyStateRoot>
        );
    }

    return (
        <div className='overflow-y-auto shrink-0 p-2 flex-1 max-h-[300px]'>
            <div className='flex flex-col gap-2'>
                {invitations.map((invitation) => (
                    <InvitationRow
                        key={invitation._id}
                        email={invitation.email}
                        createdAt={invitation.createdAt}
                        onCancel={() => onCancelInvitation(invitation._id)}
                        isLoading={cancelingId === invitation._id}
                    />
                ))}
            </div>
        </div>
    );
};
