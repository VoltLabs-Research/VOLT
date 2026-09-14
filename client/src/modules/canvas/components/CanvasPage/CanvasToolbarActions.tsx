import { Button, Tooltip } from '@heroui/react';
import { Download } from 'lucide-react';
import ScreenshotMenuPopover from '../ScreenshotMenuPopover';
import useDownloadAnalysisListings from '../../hooks/use-download-analysis-listings';

interface CanvasToolbarActionsProps {
    analysisId?: string;
    canDownloadAnalysis: boolean;
}

const CanvasToolbarActions = ({ analysisId, canDownloadAnalysis }: CanvasToolbarActionsProps) => {
    const { download, isDownloading } = useDownloadAnalysisListings();

    return (
        <div className='flex flex-row items-center gap-1'>
            <ScreenshotMenuPopover />
            {canDownloadAnalysis && analysisId && (
                <Tooltip>
                    <Button
                        variant='ghost'
                        size='sm'
                        isIconOnly
                        aria-label='Download analysis'
                        isPending={isDownloading}
                        onPress={() => void download({ analysisId })}
                    >
                        <Download size={14} aria-hidden='true' />
                    </Button>
                    <Tooltip.Content placement='bottom'>Download every listing and sub-listing as CSV</Tooltip.Content>
                </Tooltip>
            )}
        </div>
    );
};

export default CanvasToolbarActions;
