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
        <div className='flex flex-col items-center justify-center w-full h-dvh bg-background'>
            <div className='flex flex-col items-center gap-6 rounded-2xl text-center max-w-[480px] p-10'>
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
        <div className='flex flex-row items-start flex-wrap gap-4 rounded-xl p-4 bg-surface-tertiary w-full'>
            {children}
        </div>
    );
};

export const TeamInvitationDetailItem = ({ label, value }: TeamInvitationDetailItemProps) => {
    return (
        <div className='flex flex-col flex-1 min-w-[100px]'>
            <span className='block text-xs text-muted mb-1'>{label}</span>
            <span className='text-sm text-muted justify-center'>{value}</span>
        </div>
    );
};
