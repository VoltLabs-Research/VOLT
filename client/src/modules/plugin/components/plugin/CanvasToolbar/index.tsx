import Button from '@/shared/presentation/primitives/Button';
import Divider from '@/shared/presentation/primitives/Divider';
import FloatingToolbar from '@/shared/presentation/primitives/FloatingToolbar';
import Row from '@/shared/presentation/primitives/Row';
import SaveStatusIndicator from '@/shared/presentation/primitives/SaveStatusIndicator';
import Text from '@/shared/presentation/primitives/Text';
import Tooltip from '@/shared/presentation/primitives/Tooltip';
import type { SaveStatus } from '@/shared/presentation/primitives/SaveStatusIndicator';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import { useReactFlow } from '@xyflow/react';
import { ZoomIn, ZoomOut, Maximize, Save, AlertTriangle } from 'lucide-react';
import { useCallback } from 'react';

interface CanvasToolbarProps {
    saveStatus: SaveStatus;
    onSave: () => void;
    zoom: number;
}

const CanvasToolbar = ({ saveStatus, onSave, zoom }: CanvasToolbarProps) => {
    const { zoomIn, zoomOut, fitView } = useReactFlow();
    const zoomPercent = Math.round(zoom * 100);
    const validationResult = usePluginBuilderStore((state) => state.validationResult);
    const hasErrors = validationResult && !validationResult.valid && validationResult.errors.length > 0;

    const handleZoomIn = useCallback(() => { zoomIn(); }, [zoomIn]);
    const handleZoomOut = useCallback(() => { zoomOut(); }, [zoomOut]);
    const handleFitView = useCallback(() => { fitView({ padding: 0.2 }); }, [fitView]);

    return (
        <FloatingToolbar placement='bottom' align='center' offset={1.25} className='canvas-toolbar'>
            <SaveStatusIndicator status={saveStatus} className='canvas-toolbar-status' />

            {hasErrors && (
                <Tooltip
                    content={validationResult!.errors.join(' · ')}
                    placement='top'
                >
                    <Row gap='05' cursor='pointer' className='canvas-toolbar-status canvas-toolbar-status--error'>
                        <AlertTriangle size={14} />
                        <Text as='p' size='sm'>
                            {validationResult!.errors.length} {validationResult!.errors.length === 1 ? 'issue' : 'issues'}
                        </Text>
                    </Row>
                </Tooltip>
            )}

            <Row gap='025'>
                <Tooltip content='Zoom out' placement='top'>
                    <Button variant='ghost' intent='neutral' iconOnly size='sm' onClick={handleZoomOut}>
                        <ZoomOut size={16} />
                    </Button>
                </Tooltip>
                <Text as='p' size='sm' tone='secondary' align='center' className='u-select-none canvas-toolbar-zoom-label tabular-nums'>
                    {zoomPercent}%
                </Text>
                <Tooltip content='Zoom in' placement='top'>
                    <Button variant='ghost' intent='neutral' iconOnly size='sm' onClick={handleZoomIn}>
                        <ZoomIn size={16} />
                    </Button>
                </Tooltip>
                <Divider orientation='vertical' className='canvas-toolbar-divider' />
                <Tooltip content='Fit to view' placement='top'>
                    <Button variant='ghost' intent='neutral' iconOnly size='sm' onClick={handleFitView}>
                        <Maximize size={16} />
                    </Button>
                </Tooltip>
            </Row>

            <Tooltip content='Save (Ctrl+S)' placement='top'>
                <Button
                    variant='ghost'
                    intent='neutral'
                    iconOnly
                    size='sm'
                    onClick={onSave}
                    disabled={saveStatus === 'saving'}
                >
                    <Save size={16} />
                </Button>
            </Tooltip>
        </FloatingToolbar>
    );
};

export default CanvasToolbar;
