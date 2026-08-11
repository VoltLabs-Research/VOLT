import { Button, Tooltip } from '@heroui/react';
import { Download } from 'lucide-react';

interface CanvasToolbarActionsProps {
    canDownloadAnalysis: boolean;
    isDownloadingAnalysis: boolean;
    onDownloadAnalysis: () => void;
}

const CanvasToolbarActions = ({
    canDownloadAnalysis,
    isDownloadingAnalysis,
    onDownloadAnalysis
}: CanvasToolbarActionsProps) => {
    if (!canDownloadAnalysis) {
        return null;
    }

    return (
        <div className='flex flex-row items-center gap-2'>
            <Tooltip>
                <Button
                    variant='ghost'
                    size='sm'
                    className='text-xs'
                    isPending={isDownloadingAnalysis}
                    onPress={() => onDownloadAnalysis()}
                >
                    <Download size={12} />
                    Download Analysis
                </Button>
                <Tooltip.Content placement='bottom'>Download analysis listings</Tooltip.Content>
            </Tooltip>
        </div>
    );
};

export default CanvasToolbarActions;
