import { ProgressBar } from '@voltstack/bravais';
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

    const hasProgress = progress !== undefined;

    return (
        <div className='flex flex-row items-center justify-center absolute inset-0 canvas-preload-overlay'>
            <ProgressBar
                className="canvas-preload-card"
                size='sm'
                label={description ?? title}
                value={hasProgress ? progress * 100 : undefined}
                showValue={hasProgress}
                indeterminate={!hasProgress}
            />
        </div>
    );
};

export default PreloadingOverlay;
