import { Button, Heading, Row, Stack, Surface, Text } from '@/shared/presentation/primitives';
import type { ReactNode } from 'react';

interface DangerZoneProps{
    title: string;
    description: string;
    actionLabel: string;
    actionIcon?: ReactNode;
    onAction: () => void;
};

const DangerZone = ({
    title,
    description,
    actionIcon,
    actionLabel,
    onAction
}: DangerZoneProps) => {
    return (
        <Surface variant='danger' p='1' role='region' aria-label={title}>
            <Row justify='between' gap='1'>
                <Stack gap='025'>
                    <Heading level={2} size='md' weight='bold'>
                        {title}
                    </Heading>
                    <Text as='p' tone='muted' size='sm'>
                        {description}
                    </Text>
                </Stack>
                <Button
                    intent='danger'
                    variant='outline'
                    size='sm'
                    leftIcon={actionIcon}
                    onClick={onAction}
                >
                    {actionLabel}
                </Button>
            </Row>
        </Surface>
    );
};

export default DangerZone;
