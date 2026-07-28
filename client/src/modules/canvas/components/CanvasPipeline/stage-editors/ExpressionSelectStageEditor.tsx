import { useCanvasPipelineStore } from '../../../store/canvas-pipeline';
import useExpressionSelect from '../../../hooks/use-expression-select';
import { trajectoryAtomsQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import { Button, Row, Stack, Text } from '@voltstack/bravais';
import { memo, useCallback, useEffect, useState } from 'react';
import {
    DEFAULT_EXPRESSION_SELECT_COLOR,
    type ExpressionSelectAction,
    type ExpressionSelectStageConfig
} from '../../../store/canvas-pipeline';

interface ExpressionSelectStageEditorProps {
    stageId: string;
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
    onSave?: () => void;
}

const TEXTAREA_ROWS = 3;

const ACTION_OPTIONS = [
    {
        value: 'color',
        title: 'Color selection'
    },
    {
        value: 'delete',
        title: 'Delete selection'
    }
];

const isAction = (value: string): value is ExpressionSelectAction =>
    ACTION_OPTIONS.some((option) => option.value === value);

const ExpressionSelectStageEditor = memo(({
    stageId,
    trajectoryId,
    analysisId,
    currentTimestep,
    onSave
}: ExpressionSelectStageEditorProps) => {
    const stage = useCanvasPipelineStore((s) =>
        (trajectoryId ? s.byTrajectory[trajectoryId] : undefined)?.find((entry) => entry.id === stageId)
    );
    const updateStageConfig = useCanvasPipelineStore((s) => s.updateStageConfig);

    const config = stage?.config as ExpressionSelectStageConfig | undefined;
    const expression = config?.expression ?? '';
    const action: ExpressionSelectAction = config?.action === 'delete' ? 'delete' : 'color';
    const color = config?.color ?? DEFAULT_EXPRESSION_SELECT_COLOR;
    const [draft, setDraft] = useState(expression);

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

    useEffect(() => {
        setDraft(expression);
    }, [expression]);

    const handleApply = useCallback(() => {
        updateStageConfig(stageId, { expression: draft } as Partial<ExpressionSelectStageConfig>, trajectoryId);
        onSave?.();
    }, [draft, stageId, trajectoryId, updateStageConfig, onSave]);

    const handleClear = useCallback(() => {
        setDraft('');
        updateStageConfig(stageId, { expression: '' } as Partial<ExpressionSelectStageConfig>, trajectoryId);
    }, [stageId, trajectoryId, updateStageConfig]);

    const handleActionChange = useCallback((_fieldKey: string, value: unknown) => {
        const next = String(value);
        if (isAction(next)) {
            updateStageConfig(stageId, { action: next } as Partial<ExpressionSelectStageConfig>, trajectoryId);
        }
    }, [stageId, trajectoryId, updateStageConfig]);

    const handleColorChange = useCallback((next: string) => {
        updateStageConfig(stageId, { color: next } as Partial<ExpressionSelectStageConfig>, trajectoryId);
    }, [stageId, trajectoryId, updateStageConfig]);

    const hasExpression = draft.trim().length > 0;

    return (
        <Stack gap='05' className='expression-select-chip'>
            <Text size='xs' tone='muted'>Boolean expression over atom columns</Text>
            <textarea
                className='expression-select-chip__input canvas-code-input'
                rows={TEXTAREA_ROWS}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder='e.g. Position.X > 10 && StructureType == 2'
                aria-label='Expression formula'
                spellCheck={false}
            />

            <FormFieldRHF
                fieldKey='expression-select-action'
                fieldType='select'
                label='With selection'
                fieldValue={action}
                onFieldChange={handleActionChange}
                options={ACTION_OPTIONS}
                variant='canvas'
            />

            {action === 'color' && (
                <Row gap='05' align='center'>
                    <Text size='xs' tone='muted'>Highlight color</Text>
                    <input
                        type='color'
                        className='expression-select-chip__color'
                        value={color}
                        onChange={(e) => handleColorChange(e.target.value)}
                        aria-label='Selection highlight color'
                    />
                </Row>
            )}

            {hasExpression && !autoRoute && (
                <Row gap='05' align='center'>
                    {isValid && matchCount !== null && (
                        <Text size='xs' tone='secondary' className='expression-select-chip__match-count'>
                            {matchCount} atoms {action === 'delete' ? 'will be deleted' : 'selected'}
                        </Text>
                    )}
                    {!isValid && error && (
                        <Text size='xs' tone='muted' className='expression-select-chip__error'>
                            {error}
                        </Text>
                    )}
                </Row>
            )}
            {autoRoute && (
                <Text size='xs' tone='muted'>
                    Large dataset — route to daemon on apply
                </Text>
            )}
            <Row gap='05'>
                <Button
                    variant='solid'
                    intent='brand'
                    size='sm'
                    shape='rounded'
                    onClick={handleApply}
                    disabled={!hasExpression || (!autoRoute && !isValid)}
                >
                    Apply
                </Button>
                {hasExpression && (
                    <Button
                        variant='ghost'
                        size='sm'
                        shape='rounded'
                        onClick={handleClear}
                    >
                        Clear
                    </Button>
                )}
            </Row>
        </Stack>
    );
});

ExpressionSelectStageEditor.displayName = 'ExpressionSelectStageEditor';

export default ExpressionSelectStageEditor;
