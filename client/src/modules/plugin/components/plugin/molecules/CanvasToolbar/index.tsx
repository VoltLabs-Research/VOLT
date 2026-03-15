import { PluginBuilderSaveStatus } from '@/modules/plugin/components/plugin/organisms/PluginBuilder/save-status';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import { usePluginDebugStore } from '@/modules/plugin/stores/plugin/use-plugin-debug-store';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Divider from '@/shared/presentation/components/Divider';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Tooltip from '@/shared/presentation/components/Tooltip';
import { useReactFlow } from '@xyflow/react';
import { AlertTriangle, Check, ChevronDown, ChevronUp, Maximize, Save, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';

interface CanvasToolbarProps {
    saveStatus: PluginBuilderSaveStatus;
    onDismissSaveError: () => void;
    onSave: () => void;
    zoom: number;
};

interface SaveStatusContent {
    detail: string;
    label: string;
    liveMessage: string;
    modifierClassName: string;
};

const CanvasToolbar = ({ saveStatus, onDismissSaveError, onSave, zoom }: CanvasToolbarProps) => {
    const { zoomIn, zoomOut, fitView } = useReactFlow();
    const zoomPercent = Math.round(zoom * 100);
    const validationResult = usePluginBuilderStore((state) => state.validationResult);
    const saveError = usePluginBuilderStore((state) => state.saveError);
    const isDebugging = usePluginDebugStore((state) => state.isDebugging);
    const isPaused = usePluginDebugStore((state) => state.isPaused);
    const validationErrors = validationResult?.errors ?? [];
    const hasErrors = Boolean(validationResult && !validationResult.valid && validationErrors.length > 0);
    const isDebugPrimaryMode = isDebugging && isPaused;
    const validationPanelId = useId();
    const [isValidationOpen, setIsValidationOpen] = useState(hasErrors);

    const validationSignature = useMemo(() => {
        return validationErrors.join('|');
    }, [validationErrors]);

    useEffect(() => {
        setIsValidationOpen(hasErrors);
    }, [hasErrors, validationSignature]);

    let saveStatusContent: SaveStatusContent | null = null;
    if (saveStatus === PluginBuilderSaveStatus.Saving) {
        saveStatusContent = {
            detail: 'Saving workflow…',
            label: 'Saving',
            liveMessage: 'Saving workflow.',
            modifierClassName: 'canvas-toolbar-status--saving'
        };
    } else if (saveStatus === PluginBuilderSaveStatus.Saved) {
        saveStatusContent = {
            detail: 'All changes saved.',
            label: 'Saved',
            liveMessage: 'Workflow saved.',
            modifierClassName: 'canvas-toolbar-status--saved'
        };
    } else if (saveStatus === PluginBuilderSaveStatus.Error) {
        saveStatusContent = {
            detail: 'Save failed.',
            label: 'Save error',
            liveMessage: 'Workflow save failed.',
            modifierClassName: 'canvas-toolbar-status--error'
        };
    }

    const handleZoomIn = useCallback(() => { zoomIn(); }, [zoomIn]);
    const handleZoomOut = useCallback(() => { zoomOut(); }, [zoomOut]);
    const handleFitView = useCallback(() => { fitView({ padding: 0.2 }); }, [fitView]);
    const handleToggleValidation = useCallback(() => {
        setIsValidationOpen((currentState) => !currentState);
    }, []);
    const handleDismissSaveError = useCallback(() => {
        onDismissSaveError();
    }, [onDismissSaveError]);

    return (
        <Container className='p-absolute z-10 center-x d-flex column items-center gap-05 canvas-toolbar-shell'>
            {saveStatusContent && (
                <Container className='plugin-accessible-status' role='status' aria-live='polite'>
                    {saveStatusContent.liveMessage}
                </Container>
            )}

            {hasErrors && (
                <Container className='plugin-accessible-status' role='status' aria-live='polite'>
                    Workflow has {validationErrors.length} {validationErrors.length === 1 ? 'issue' : 'issues'}.
                </Container>
            )}

            <Container className='d-flex items-center gap-05 b-soft radius-full canvas-toolbar' role='toolbar' aria-label='Canvas controls'>
                {saveStatusContent && (
                    <Container className={`d-flex items-center gap-05 canvas-toolbar-status ${saveStatusContent.modifierClassName}`}>
                        {saveStatus === PluginBuilderSaveStatus.Saving && (
                            <Container className='f-shrink-0 radius-full canvas-toolbar-status-dot' aria-hidden='true' />
                        )}
                        {saveStatus === PluginBuilderSaveStatus.Saved && <Check size={14} aria-hidden='true' />}
                        {saveStatus === PluginBuilderSaveStatus.Error && <AlertTriangle size={14} aria-hidden='true' />}
                        <Container className='d-flex column gap-025 min-w-0'>
                            <Paragraph className='font-size-1 color-secondary canvas-toolbar-status-label'>{saveStatusContent.label}</Paragraph>
                            <Paragraph className='font-size-2 canvas-toolbar-status-copy'>{saveStatusContent.detail}</Paragraph>
                        </Container>
                    </Container>
                )}

                {hasErrors && (
                    <Button
                        variant='soft'
                        intent='danger'
                        size='sm'
                        className='canvas-toolbar-issue-toggle'
                        aria-controls={validationPanelId}
                        aria-expanded={isValidationOpen}
                        onClick={handleToggleValidation}
                        leftIcon={<AlertTriangle size={16} />}
                        rightIcon={isValidationOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    >
                        Workflow issues ({validationErrors.length})
                    </Button>
                )}

                <Container className='d-flex items-center gap-025'>
                    <Tooltip content='Zoom out' placement='top'>
                        <Button variant='ghost' intent='neutral' iconOnly size='sm' className='canvas-toolbar-action' aria-label='Zoom out' title='Zoom out' onClick={handleZoomOut}>
                            <ZoomOut size={16} />
                        </Button>
                    </Tooltip>
                    <Paragraph className='text-center u-select-none canvas-toolbar-zoom-label color-secondary font-size-2'>
                        {zoomPercent}%
                    </Paragraph>
                    <Tooltip content='Zoom in' placement='top'>
                        <Button variant='ghost' intent='neutral' iconOnly size='sm' className='canvas-toolbar-action' aria-label='Zoom in' title='Zoom in' onClick={handleZoomIn}>
                            <ZoomIn size={16} />
                        </Button>
                    </Tooltip>
                    <Divider orientation='vertical' className='canvas-toolbar-divider' />
                    <Tooltip content='Fit to view' placement='top'>
                        <Button variant='ghost' intent='neutral' iconOnly size='sm' className='canvas-toolbar-action' aria-label='Fit to view' title='Fit to view' onClick={handleFitView}>
                            <Maximize size={16} />
                        </Button>
                    </Tooltip>
                </Container>

                <Tooltip content='Save (Ctrl+S)' placement='top'>
                    <Button
                        variant={isDebugPrimaryMode ? 'outline' : 'solid'}
                        intent='brand'
                        size='sm'
                        className='canvas-toolbar-action canvas-toolbar-save-action'
                        aria-keyshortcuts='Control+S'
                        onClick={onSave}
                        disabled={saveStatus === PluginBuilderSaveStatus.Saving}
                        title='Save workflow (Ctrl+S)'
                        leftIcon={<Save size={16} />}
                    >
                        Save
                    </Button>
                </Tooltip>
            </Container>

            {saveError && (
                <Container className='d-flex items-start gap-05 radius-md p-1 canvas-toolbar-feedback-panel canvas-toolbar-feedback-panel--error' role='alert' aria-live='assertive'>
                    <AlertTriangle size={16} className='canvas-toolbar-feedback-icon' aria-hidden='true' />
                    <Container className='d-flex items-start gap-075 min-w-0 canvas-toolbar-feedback-content'>
                        <Container className='d-flex column gap-025 min-w-0 flex-1'>
                            <Paragraph className='font-size-1 font-weight-6 canvas-toolbar-feedback-title'>Save error</Paragraph>
                            <Paragraph className='font-size-2 canvas-toolbar-feedback-copy'>{saveError}</Paragraph>
                        </Container>
                        <Button
                            variant='ghost'
                            intent='neutral'
                            iconOnly
                            size='sm'
                            className='canvas-toolbar-feedback-dismiss'
                            aria-label='Dismiss save error'
                            title='Dismiss save error'
                            onClick={handleDismissSaveError}
                        >
                            <X size={16} />
                        </Button>
                    </Container>
                </Container>
            )}

            {hasErrors && isValidationOpen && (
                <Container id={validationPanelId} className='d-flex column gap-075 radius-md p-1 canvas-toolbar-feedback-panel canvas-toolbar-feedback-panel--validation' role='region' aria-label='Workflow validation issues'>
                    <Container className='d-flex items-start gap-05'>
                        <AlertTriangle size={16} className='canvas-toolbar-feedback-icon' aria-hidden='true' />
                        <Container className='d-flex column gap-025 min-w-0'>
                            <Paragraph className='font-size-1 font-weight-6 canvas-toolbar-feedback-title'>Workflow issues</Paragraph>
                            <Paragraph className='font-size-2 canvas-toolbar-feedback-copy'>Review and fix these items directly from the canvas.</Paragraph>
                        </Container>
                    </Container>

                    <ul className='d-flex column gap-05 canvas-toolbar-issue-list'>
                        {validationErrors.map((errorMessage, index) => (
                            <li key={`${errorMessage}-${index}`} className='d-flex items-start gap-05 canvas-toolbar-issue-item'>
                                <span className='canvas-toolbar-issue-label'>Issue {index + 1}</span>
                                <Paragraph className='font-size-2 canvas-toolbar-issue-copy'>{errorMessage}</Paragraph>
                            </li>
                        ))}
                    </ul>
                </Container>
            )}
        </Container>
    );
};

export default CanvasToolbar;
