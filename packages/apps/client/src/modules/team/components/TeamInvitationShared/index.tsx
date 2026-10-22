import Loader from '@/shared/ui/components/Loader';
import { cn } from '@heroui/react';
import type { ReactNode } from 'react';

type TeamInvitationCardProps = {
    children: ReactNode;
};

type TeamInvitationStateCardProps = {
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
};

type TeamInvitationHeadingProps = {
    eyebrow?: ReactNode;
    title: ReactNode;
    description?: ReactNode;
};

type TeamInvitationDetailsProps = {
    children: ReactNode;
};

type TeamInvitationDetailItemProps = {
    label: ReactNode;
    value: ReactNode;
    valueClassName?: string;
};

type TeamInvitationActionsProps = {
    children: ReactNode;
};

// A plain column on the page: no card, no glyph, no box around the details.
export const TeamInvitationCard = ({ children }: TeamInvitationCardProps) => {
    return (
        <div className='flex items-center justify-center w-full min-h-dvh bg-background px-4 py-18'>
            <div className='flex flex-col gap-7 w-full max-w-md'>
                {children}
            </div>
        </div>
    );
};

export const TeamInvitationHeading = ({ eyebrow, title, description }: TeamInvitationHeadingProps) => {
    return (
        <div className='flex flex-col gap-2'>
            {eyebrow && <p className='text-sm text-muted'>{eyebrow}</p>}
            <h1 className='text-2xl font-semibold tracking-tight text-balance text-foreground'>{title}</h1>
            {description && <p className='text-sm text-muted'>{description}</p>}
        </div>
    );
};

export const TeamInvitationStateCard = ({
    title,
    description,
    action
}: TeamInvitationStateCardProps) => {
    return (
        <TeamInvitationCard>
            <TeamInvitationHeading title={title} description={description} />
            {action && <div className='self-start'>{action}</div>}
        </TeamInvitationCard>
    );
};

export const TeamInvitationLoader = () => {
    return (
        <div className='flex items-center justify-center w-full min-h-dvh bg-background'>
            <Loader aria-label='Loading invitation' />
        </div>
    );
};

export const TeamInvitationDetails = ({ children }: TeamInvitationDetailsProps) => {
    return (
        <dl className='grid gap-2 text-base'>
            {children}
        </dl>
    );
};

export const TeamInvitationDetailItem = ({ label, value, valueClassName }: TeamInvitationDetailItemProps) => {
    return (
        <div className='grid grid-cols-[6rem_minmax(0,1fr)] gap-4'>
            <dt className='text-muted'>{label}</dt>
            <dd className={cn('text-foreground wrap-anywhere', valueClassName)}>{value}</dd>
        </div>
    );
};

export const TeamInvitationActions = ({ children }: TeamInvitationActionsProps) => {
    return (
        <div className='grid grid-cols-1 gap-2 min-[30rem]:grid-cols-2'>
            {children}
        </div>
    );
};
