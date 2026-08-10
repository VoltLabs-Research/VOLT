import type { ReactNode } from 'react';

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
        <div className='flex flex-col items-center justify-center w-full h-dvh team-invitation-page'>
            <div className='flex flex-col items-center gap-6 rounded-2xl text-center team-invitation-card'>
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
        <div className='flex flex-row items-start flex-wrap gap-4 rounded-xl team-invitation-details'>
            {children}
        </div>
    );
};

export const TeamInvitationDetailItem = ({ label, value }: TeamInvitationDetailItemProps) => {
    return (
        <div className='flex flex-col team-invitation-detail'>
            <span className='team-invitation-detail-label'>{label}</span>
            <span className='team-invitation-detail-value'>{value}</span>
        </div>
    );
};
