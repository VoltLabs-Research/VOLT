import { Button, Callout, Divider, FloatingToolbar, Row, SaveStatusIndicator, Stack, Text, Tooltip } from '@voltstack/bravais';
import type { SaveStatus } from '@voltstack/bravais';
import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
import { useReactFlow } from '@xyflow/react';
import { ZoomIn, ZoomOut, Maximize, Save, AlertTriangle } from 'lucide-react';

interface CanvasToolbarProps {
    saveStatus: SaveStatus;
    onSave: () => void;
    zoom: number;
}

const CanvasToolbar = ({ saveStatus, onSave, zoom }: CanvasToolbarProps) => {
    const { zoomIn, zoomOut, fitView } = useReactFlow();
    const errors = usePluginBuilderStore((state) => state.validationErrors);

    const issueSummary = `${errors.length} ${errors.length === 1 ? 'issue' : 'issues'}`;

    return (
        <>
            {errors.length > 0 && (
                <Callout
                    tone='danger'
                    title={`${issueSummary} to fix before publishing`}
                    icon={<AlertTriangle size={14} />}
                    role='alert'
                    ariaLive='polite'
                    className='canvas-toolbar-validation'
                >
                    <Stack as='ul' gap='025' className='canvas-toolbar-validation-list'>
                        {errors.map((error, index) => (
                            <Text key={index} as='li' size='sm'>
                                {error}
                            </Text>
                        ))}
                    </Stack>
                </Callout>
            )}

            <FloatingToolbar placement='bottom' align='center' offset={1.25} className='canvas-toolbar'>
                <SaveStatusIndicator status={saveStatus} className='canvas-toolbar-status' />

                {errors.length > 0 && (
                    <Tooltip
                        content={errors.join(' · ')}
                        placement='top'
                    >
                        <Row gap='05' cursor='pointer' className='canvas-toolbar-status canvas-toolbar-status--error'>
                            <AlertTriangle size={14} />
                            <Text as='p' size='sm'>
                                {issueSummary}
                            </Text>
                        </Row>
                    </Tooltip>
                )}

                <Row gap='025'>
                    <Tooltip content='Zoom out' placement='top'>
                        <Button variant='ghost' intent='neutral' iconOnly size='sm' onClick={() => zoomOut()}>
                            <ZoomOut size={16} />
                        </Button>
                    </Tooltip>
                    <Text as='p' size='sm' tone='secondary' align='center' className='u-select-none canvas-toolbar-zoom-label tabular-nums'>
                        {Math.round(zoom * 100)}%
                    </Text>
                    <Tooltip content='Zoom in' placement='top'>
                        <Button variant='ghost' intent='neutral' iconOnly size='sm' onClick={() => zoomIn()}>
                            <ZoomIn size={16} />
                        </Button>
                    </Tooltip>
                    <Divider orientation='vertical' className='canvas-toolbar-divider' />
                    <Tooltip content='Fit to view' placement='top'>
                        <Button variant='ghost' intent='neutral' iconOnly size='sm' onClick={() => fitView({ padding: 0.2 })}>
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
        </>
    );
};

export default CanvasToolbar;
