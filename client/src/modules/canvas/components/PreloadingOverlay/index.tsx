import { useEditorStore } from '@/modules/canvas/stores/editor';

import { useShallow } from 'zustand/react/shallow';
import Loader from '@/shared/presentation/components/Loader';
import './PreloadingOverlay.css';

const PreloadingOverlay = () => {
    const { isPreloading, preloadProgress } = useEditorStore(useShallow((state) => ({
        isPreloading: state.isPreloading,
        preloadProgress: state.preloadProgress
    })));
    const progress = preloadProgress ?? 0;

    if (!isPreloading) return null;

    return (
        <div className="volt-container canvas-preload-overlay d-flex items-center content-center p-absolute inset-0">
            <div className="volt-container canvas-preload-card d-flex column items-center gap-05 radius-lg">
                <Loader scale={0.7} />
                <h3 className="volt-title font-size-2" style={{ marginTop: '7rem' }}>Setting up your scene...</h3>
                <p className="volt-text font-size-1 color-secondary">
                    {Math.round(progress * 100)}% loaded
                </p>
            </div>
        </div>
    );
};

export default PreloadingOverlay;
