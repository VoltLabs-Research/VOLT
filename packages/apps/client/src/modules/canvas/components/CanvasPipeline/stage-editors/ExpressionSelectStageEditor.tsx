import useStageConfig from '@/modules/canvas/hooks/use-stage-config';
import useExpressionSelect from './use-expression-select';
import { trajectoryAtomsQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import StageEditorLayout from '../StageEditorLayout';
import {
    Button,
    ColorArea,
    ColorField,
    ColorPicker,
    ColorSlider,
    ColorSwatch,
    ToggleButton,
    ToggleButtonGroup,
    cn
} from '@heroui/react';
import { useLayoutEffect, useRef, useState } from 'react';
import {
    DEFAULT_EXPRESSION_SELECT_COLOR,
    type ExpressionSelectAction,
    type ExpressionSelectStageConfig
} from '@/modules/canvas/store/canvas-pipeline';

interface ExpressionSelectStageEditorProps {
    stageId: string;
    trajectoryId?: string;
    // The stage's pipeline in the store; defaults to the trajectory's draft.
    pipelineKey?: string;
    analysisId?: string;
    currentTimestep?: number;
    onSave?: () => void;
}

const ACTION_OPTIONS: { value: ExpressionSelectAction; label: string }[] = [
    { value: 'color', label: 'Color' },
    { value: 'delete', label: 'Delete' }
];

const isExpressionSelectAction = (value: string): value is ExpressionSelectAction =>
    ACTION_OPTIONS.some((option) => option.value === value);

const ExpressionSelectStageEditor = ({
    stageId,
    trajectoryId,
    pipelineKey = trajectoryId,
    analysisId,
    currentTimestep,
    onSave
}: ExpressionSelectStageEditorProps) => {
    const { config, patch } = useStageConfig<ExpressionSelectStageConfig>(stageId, pipelineKey);

    const action = config?.action ?? 'color';
    const color = config?.color ?? DEFAULT_EXPRESSION_SELECT_COLOR;
    const appliedExpression = config?.expression ?? '';
    const [draft, setDraft] = useState(appliedExpression);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const { data: atomBuffer } = trajectoryAtomsQuery(
        {
            trajectoryId: trajectoryId ?? '',
            analysisId,
            timestep: currentTimestep ?? 0,
            page: 1,
            limit: 1000
        },
        { enabled: Boolean(trajectoryId && currentTimestep !== undefined) }
    );

    const { matchCount, isValid, error, autoRoute } = useExpressionSelect(
        draft,
        atomBuffer,
        currentTimestep,
        0
    );

    // The field grows with the expression instead of showing a resize handle.
    useLayoutEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    }, [draft]);

    const hasExpression = draft.trim().length > 0;
    const isDirty = draft !== appliedExpression;
    const canApply = hasExpression && isDirty && (autoRoute || isValid);
    const isDelete = action === 'delete';

    // The count covers the atoms loaded for preview; say so when that is not the whole frame.
    const sampleSize = atomBuffer?.count ?? 0;
    const isWholeFrame = Boolean(atomBuffer && atomBuffer.total <= atomBuffer.count);
    const hasCount = hasExpression && isValid && matchCount !== null;

    let status: string | null = null;
    if (autoRoute && hasExpression) {
        status = 'Large dataset — evaluated on the daemon';
    } else if (hasCount) {
        status = `${matchCount.toLocaleString()} of ${isWholeFrame ? '' : 'first '}${sampleSize.toLocaleString()} atoms`;
    }

    const applyLabel = isDelete && hasCount && isWholeFrame
        ? `Delete ${matchCount.toLocaleString()} atoms`
        : 'Apply';

    const handleApply = () => {
        patch({ expression: draft });
        onSave?.();
    };

    return (
        <StageEditorLayout
            footer={(
                <div className='flex flex-row items-center justify-end gap-2'>
                    {isDirty && (
                        <Button
                            variant='ghost'
                            size='sm'
                            className='text-xs'
                            onPress={() => setDraft(appliedExpression)}
                        >
                            Revert
                        </Button>
                    )}
                    <Button
                        variant={isDelete ? 'danger' : 'primary'}
                        size='sm'
                        className='text-xs'
                        onPress={handleApply}
                        isDisabled={!canApply}
                    >
                        {applyLabel}
                    </Button>
                </div>
            )}
        >
            <div
                className={cn(
                    'flex flex-col rounded-xl bg-surface-secondary transition-shadow focus-within:ring-2 focus-within:ring-foreground/20',
                    hasExpression && !isValid && !autoRoute && error && 'ring-1 ring-danger/70 focus-within:ring-danger/70'
                )}
            >
                <textarea
                    ref={textareaRef}
                    // Its container draws the focus ring; this slot opts out of the global outline.
                    data-slot='expression-textarea'
                    className='w-full resize-none overflow-hidden bg-transparent px-2.5 pb-1 pt-2 font-mono text-xs leading-[1.5] text-foreground outline-none'
                    rows={2}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder='e.g. Position.X > 10 && StructureType == 2'
                    aria-label='Expression formula'
                    spellCheck={false}
                />
                <div className='flex min-h-5 flex-row items-center justify-between gap-2 px-2.5 pb-1.5 text-2xs tabular-nums text-muted'>
                    <span className='min-w-0 truncate text-danger'>
                        {hasExpression && !isValid && !autoRoute ? error : null}
                    </span>
                    {status && <span className='shrink-0'>{status}</span>}
                </div>
            </div>

            <ToggleButtonGroup
                aria-label='With selection'
                selectionMode='single'
                disallowEmptySelection
                selectedKeys={[action]}
                onSelectionChange={(keys) => {
                    for (const key of keys) {
                        const next = String(key);
                        if (isExpressionSelectAction(next)) patch({ action: next });
                    }
                }}
                size='sm'
                className='w-full'
            >
                {ACTION_OPTIONS.map((option) => (
                    <ToggleButton key={option.value} id={option.value} className='flex-1 text-xs'>
                        {option.label}
                    </ToggleButton>
                ))}
            </ToggleButtonGroup>

            {action === 'color' && (
                <div className='flex flex-row items-center justify-between gap-2 text-xs'>
                    <span className='text-muted'>Highlight</span>
                    <ColorPicker
                        value={color}
                        onChange={(next) => patch({ color: next.toString('hex') })}
                    >
                        <ColorPicker.Trigger aria-label='Selection highlight color'>
                            <ColorSwatch size='sm' />
                        </ColorPicker.Trigger>
                        <ColorPicker.Popover>
                            <ColorArea colorSpace='hsb' xChannel='saturation' yChannel='brightness'>
                                <ColorArea.Thumb />
                            </ColorArea>
                            <ColorSlider colorSpace='hsb' channel='hue' aria-label='Hue'>
                                <ColorSlider.Track>
                                    <ColorSlider.Thumb />
                                </ColorSlider.Track>
                            </ColorSlider>
                            <ColorField aria-label='Hex color'>
                                <ColorField.Group>
                                    <ColorField.Input />
                                </ColorField.Group>
                            </ColorField>
                        </ColorPicker.Popover>
                    </ColorPicker>
                </div>
            )}
        </StageEditorLayout>
    );
};

export default ExpressionSelectStageEditor;
