import { Heading, Row, Stack, Text } from '@voltstack/bravais';
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
        <Stack align='center' justify='center' width='max' height='vh-max' className='team-invitation-page'>
            <Stack gap='1-5' align='center' textAlign='center' radius='lg' className='team-invitation-card'>
                {children}
            </Stack>
        </Stack>
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
            <Heading level={3} size='xl' weight='bold'>{title}</Heading>
            {description && (
                <Text as='p' tone='secondary'>
                    {description}
                </Text>
            )}
            {children}
            {action}
        </TeamInvitationCard>
    );
};

export const TeamInvitationDetails = ({ children }: TeamInvitationDetailsProps) => {
    return (
        <Row align='start' gap='1' wrap radius='md' className='team-invitation-details'>
            {children}
        </Row>
    );
};

export const TeamInvitationDetailItem = ({ label, value }: TeamInvitationDetailItemProps) => {
    return (
        <Stack className='team-invitation-detail'>
            <Text as='span' className='team-invitation-detail-label'>{label}</Text>
            <Text as='span' className='team-invitation-detail-value'>{value}</Text>
        </Stack>
    );
};
