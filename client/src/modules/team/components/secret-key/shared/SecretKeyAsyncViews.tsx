import { Box, Stack, Text } from '@voltstack/bravais';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import type { ReactNode } from 'react';

interface SecretKeyPageShellProps {
    header: ReactNode;
    children: ReactNode;
}

interface SecretKeyRecoveryViewProps {
    header: ReactNode;
    title: string;
    description: string;
    onRetry: () => void;
}

interface SecretKeyEmptyViewProps {
    header: ReactNode;
    message: string;
}

export const SecretKeyPageShell = ({ header, children }: SecretKeyPageShellProps) => (
    <Box height='vh-max' className='secret-key-page color-primary'>
        <Stack gap='2' width='max' className='secret-key-page-main'>
            {header}
            {children}
        </Stack>
    </Box>
);

export const SecretKeyRecoveryView = ({
    header,
    title,
    description,
    onRetry
}: SecretKeyRecoveryViewProps) => (
    <SecretKeyPageShell header={header}>
        <RecoveryState
            title={title}
            description={description}
            tone={RecoveryStateTone.Error}
            retryLabel='Try again'
            onRetry={onRetry}
        />
    </SecretKeyPageShell>
);

export const SecretKeyEmptyView = ({ header, message }: SecretKeyEmptyViewProps) => (
    <SecretKeyPageShell header={header}>
        <Box display='flex' p='3' className='flex-center'>
            <Text as='p' size='lg' tone='muted'>{message}</Text>
        </Box>
    </SecretKeyPageShell>
);
