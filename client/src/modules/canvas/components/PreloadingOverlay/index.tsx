import { ProgressBar, Row } from '@voltstack/bravais';
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

    
    const hasProgress = typeof progress === 'number';

    return (
        <Row justify='center' align='center' position='absolute' inset='0' className="canvas-preload-overlay">
            <ProgressBar
                className="canvas-preload-card"
                size='sm'
                label={description ?? title}
                value={hasProgress ? progress * 100 : undefined}
                showValue={hasProgress}
                indeterminate={!hasProgress}
            />
        </Row>
    );
};

export default PreloadingOverlay;
