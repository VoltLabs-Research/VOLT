import Heading from '@/shared/presentation/primitives/Heading';
import Loader from '@/shared/presentation/primitives/Loader';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import './PreloadingOverlay.css';

interface PreloadingOverlayProps {
    active: boolean;
    title?: string;
    description?: string;
    progress?: number;
};

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
