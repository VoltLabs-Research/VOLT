import { cn } from '@heroui/react';
import type { ReactNode } from 'react';

/**
 * The class vocabulary `TeamInvitation.css` used to own, shared by the two invitation
 * screens (`TeamInvitation` and `TeamInvitationByCode`) and by this file's own shells.
 * Both screens imported that stylesheet for these names, so they are exported here
 * rather than kept private.
 *
 * Converted by token: `--color-bg` is `--background`, `--color-surface-2` is
 * `--surface-tertiary`, and `--color-text-secondary` / `--color-text-tertiary` both
 * collapse onto `--muted` (migration spec §3a).
 */

/** `.team-invitation-page` */
export const TEAM_INVITATION_PAGE_CLASS = 'flex flex-col items-center justify-center w-full h-dvh bg-background';

/** `.team-invitation-card` */
export const TEAM_INVITATION_CARD_CLASS = 'flex flex-col items-center gap-6 rounded-2xl text-center max-w-[480px] p-10';

/** `.team-invitation-details`, minus the flex direction each call site chooses. */
export const TEAM_INVITATION_DETAILS_CLASS = 'p-4 bg-surface-tertiary w-full';

/** `.team-invitation-detail` */
export const TEAM_INVITATION_DETAIL_CLASS = 'flex-1 min-w-[100px]';

/** `.team-invitation-detail-label` */
export const TEAM_INVITATION_DETAIL_LABEL_CLASS = 'block text-xs text-muted mb-1';

/** `.team-invitation-detail-value` */
export const TEAM_INVITATION_DETAIL_VALUE_CLASS = 'text-sm text-muted justify-center';

/** `.team-invitation-actions` */
export const TEAM_INVITATION_ACTIONS_CLASS = 'mt-4';

/** `.team-invitation-icon-error` */
export const TEAM_INVITATION_ICON_ERROR_CLASS = 'text-danger';

/** `.team-invitation-icon-warning` */
export const TEAM_INVITATION_ICON_WARNING_CLASS = 'text-warning';

type TeamInvitationCardProps = {
    children: ReactNode;
};

type TeamInvitationStateCardProps = {
    icon?: ReactNode;
    title: ReactNode;
    description?: ReactNode;
    children?: ReactNode;
    action?: ReactNode;
};

type TeamInvitationDetailsProps = {
    children: ReactNode;
};

type TeamInvitationDetailItemProps = {
    label: ReactNode;
    value: ReactNode;
};

export const TeamInvitationCard = ({ children }: TeamInvitationCardProps) => {
    return (
        <div className={TEAM_INVITATION_PAGE_CLASS}>
            <div className={TEAM_INVITATION_CARD_CLASS}>
                {children}
            </div>
        </div>
    );
};

export const TeamInvitationStateCard = ({
    icon,
    title,
    description,
    children,
    action
}: TeamInvitationStateCardProps) => {
    return (
        <TeamInvitationCard>
            {icon}
            <h3 className='text-xl font-semibold text-foreground'>{title}</h3>
            {description && (
                <p className='text-muted'>
                    {description}
                </p>
            )}
            {children}
            {action}
        </TeamInvitationCard>
    );
};

export const TeamInvitationDetails = ({ children }: TeamInvitationDetailsProps) => {
    return (
        <div className={cn('flex flex-row items-start flex-wrap gap-4 rounded-xl', TEAM_INVITATION_DETAILS_CLASS)}>
            {children}
        </div>
    );
};

export const TeamInvitationDetailItem = ({ label, value }: TeamInvitationDetailItemProps) => {
    return (
        <div className={cn('flex flex-col', TEAM_INVITATION_DETAIL_CLASS)}>
            <span className={TEAM_INVITATION_DETAIL_LABEL_CLASS}>{label}</span>
            <span className={TEAM_INVITATION_DETAIL_VALUE_CLASS}>{value}</span>
        </div>
    );
};
