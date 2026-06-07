import { Heading, Loader, Row, Stack, Text } from '@voltstack/bravais';
import './PreloadingOverlay.css';

interface PreloadingOverlayProps {
    active: boolean;
    title?: string;
    description?: string;
    progress?: number;
}

const PreloadingOverlay = ({
    active,
    title = 'Loading trajectory…',
    description,
    progress
}: PreloadingOverlayProps) => {
    if (!active) return null;

    const resolvedDescription = description
        ?? (typeof progress === 'number' ? `${Math.round(progress * 100)}% loaded` : undefined);

    return (
        <Row justify='center' position='absolute' inset='0' className="canvas-preload-overlay">
            <Stack align='center' gap='05' radius='lg' className="canvas-preload-card">
                <Loader scale={0.7} />
                <Heading level={3} size='md' style={{ marginTop: '7rem' }}>{title}</Heading>
                {resolvedDescription && (
                    <Text as='p' size='sm' tone='secondary'>
                        {resolvedDescription}
                    </Text>
                )}
            </Stack>
        </Row>
    );
};

export default PreloadingOverlay;
