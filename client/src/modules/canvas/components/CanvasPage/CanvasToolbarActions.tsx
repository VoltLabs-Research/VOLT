import { Button, Tooltip } from '@heroui/react';
import { Download } from 'lucide-react';
import useDownloadAnalysisListings from '../../hooks/use-download-analysis-listings';

interface CanvasToolbarActionsProps {
    analysisId?: string;
    canDownloadAnalysis: boolean;
}

const CanvasToolbarActions = ({ analysisId, canDownloadAnalysis }: CanvasToolbarActionsProps) => {
    const { download, isDownloading } = useDownloadAnalysisListings();

    if (!canDownloadAnalysis || !analysisId) {
        return null;
    }

    return (
        <div className='flex flex-row items-center gap-2'>
            <Tooltip>
                <Button
                    variant='ghost'
                    size='sm'
                    className='text-xs'
                    isPending={isDownloading}
                    onPress={() => void download({ analysisId })}
                >
                    <Download size={12} />
                    Download Analysis
                </Button>
                <Tooltip.Content placement='bottom'>Download every listing and sub-listing as CSV</Tooltip.Content>
            </Tooltip>
        </div>
    );
};

export default CanvasToolbarActions;
