import { useEditorStore } from '@/modules/canvas/stores/editor';

import { useShallow } from 'zustand/react/shallow';
import { Loader, Row, Stack, Heading, Text } from '@/shared/presentation/primitives';
import './PreloadingOverlay.css';

const PreloadingOverlay = () => {
    const { isPreloading, preloadProgress } = useEditorStore(useShallow((state) => ({
        isPreloading: state.isPreloading,
        preloadProgress: state.preloadProgress
    })));
    const progress = preloadProgress ?? 0;

    if (!isPreloading) return null;

    return (
        <Row justify='center' position='absolute' inset='0' className="canvas-preload-overlay">
            <Stack align='center' gap='05' radius='lg' className="canvas-preload-card">
                <Loader scale={0.7} />
                <Heading level={3} size='md' style={{ marginTop: '7rem' }}>Setting up your scene...</Heading>
                <Text as='p' size='sm' tone='secondary'>
                    {Math.round(progress * 100)}% loaded
                </Text>
            </Stack>
        </Row>
    );
};

export default PreloadingOverlay;
