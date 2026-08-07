import { Button, Row, Tooltip } from '@voltstack/bravais';
import { Download, ExternalLink } from 'lucide-react';

interface CanvasToolbarActionsProps {
    canDownloadAnalysis: boolean;
    isDownloadingAnalysis: boolean;
    jupyterUrl: string | null;
    onDownloadAnalysis: () => void;
}

/** Toolbar actions for the current selection: analysis download and Jupyter hand-off. */
const CanvasToolbarActions = ({
    canDownloadAnalysis,
    isDownloadingAnalysis,
    jupyterUrl,
    onDownloadAnalysis
}: CanvasToolbarActionsProps) => {
    if (!canDownloadAnalysis && !jupyterUrl) {
        return null;
    }

    return (
        <Row gap='05'>
            {canDownloadAnalysis && (
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
            )}
            {jupyterUrl && (
                <Tooltip content='Open Jupyter in new tab'>
                    <Button
                        variant='ghost'
                        intent='canvas'
                        shape='rounded'
                        size='sm'
                        className='text-xs canvas-btn-compact'
                        leftIcon={<ExternalLink size={12} />}
                        onClick={() => window.open(jupyterUrl, '_blank', 'noopener,noreferrer')}
                    >
                        Open in New Tab
                    </Button>
                </Tooltip>
            )}
        </Row>
    );
};

export default CanvasToolbarActions;
