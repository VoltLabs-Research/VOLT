import { useShallow } from 'zustand/react/shallow';
import Container from '@/shared/presentation/components/Container';
import Loader from '@/shared/presentation/components/Loader';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import './PreloadingOverlay.css';

const PreloadingOverlay = () => {
    const { isPreloading, preloadProgress } = useEditorStore(useShallow((state) => ({
        isPreloading: state.isPreloading,
        preloadProgress: state.preloadProgress
    })));
    const progress = preloadProgress ?? 0;

    if (!isPreloading) return null;

    return (
        <Container className="canvas-preload-overlay d-flex items-center content-center p-absolute inset-0">
            <Container className="canvas-preload-card glass-bg d-flex column items-center gap-05 radius-lg">
                <Loader scale={0.7} />
                <Title className="font-size-2">Setting up your scene...</Title>
                <Paragraph className="font-size-1 color-secondary">
                    {Math.round(progress * 100)}% loaded
                </Paragraph>
            </Container>
        </Container>
    );
};

export default PreloadingOverlay;
