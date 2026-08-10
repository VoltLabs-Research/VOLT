import { Button, Row, Tooltip } from '@voltstack/bravais';
import { Download } from 'lucide-react';

interface CanvasToolbarActionsProps {
    canDownloadAnalysis: boolean;
    isDownloadingAnalysis: boolean;
    onDownloadAnalysis: () => void;
}

/** Toolbar actions for the current selection. */
const CanvasToolbarActions = ({
    canDownloadAnalysis,
    isDownloadingAnalysis,
    onDownloadAnalysis
}: CanvasToolbarActionsProps) => {
    if (!canDownloadAnalysis) {
        return null;
    }

    return (
        <Row gap='05'>
            <Tooltip content='Download analysis listings'>
                <Button
                    variant='ghost'
                    intent='canvas'
                    shape='rounded'
                    size='sm'
                    className='text-xs canvas-btn-compact'
                    leftIcon={<Download size={12} />}
                    isLoading={isDownloadingAnalysis}
                    onClick={() => onDownloadAnalysis()}
                >
                    Download Analysis
                </Button>
            </Tooltip>
        </Row>
    );
};

export default CanvasToolbarActions;
