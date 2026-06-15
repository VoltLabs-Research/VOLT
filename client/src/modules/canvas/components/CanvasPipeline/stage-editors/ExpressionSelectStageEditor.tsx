import { useCanvasPipelineStore } from '../../../stores/canvas-pipeline';
import useExpressionSelect from '../../../hooks/use-expression-select';
import { trajectoryAtomsQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import { Button, Row, Stack, Text } from '@voltstack/bravais';
import { memo, useCallback, useEffect, useState } from 'react';
import type { ExpressionSelectStageConfig } from '../../../stores/canvas-pipeline';

interface ExpressionSelectStageEditorProps {
    stageId: string;
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
    onSave?: () => void;
}

const TEXTAREA_ROWS = 3;

// Editor body for an expression-select pipeline stage. Evaluates a boolean
// expression over the columnar atom buffer in-browser (match count / validity),
// then writes it to the stage config; the engine visibility mask (see
// use-expression-visibility-mask) reads enabled stages and hides non-matching atoms.
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

    const expression = (stage?.config as ExpressionSelectStageConfig)?.expression ?? '';
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
            {hasExpression && !autoRoute && (
                <Row gap='05' align='center'>
                    {isValid && matchCount !== null && (
                        <Text size='xs' tone='secondary' className='expression-select-chip__match-count'>
                            {matchCount} atoms match
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
