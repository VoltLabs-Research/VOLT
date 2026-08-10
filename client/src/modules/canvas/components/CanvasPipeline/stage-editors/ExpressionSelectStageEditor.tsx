import useStageConfig from '@/modules/canvas/hooks/use-stage-config';
import useExpressionSelect from '../../../hooks/use-expression-select';
import { trajectoryAtomsQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import { Button } from '@voltstack/bravais';
import { useState } from 'react';
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

const ExpressionSelectStageEditor = ({
    stageId,
    trajectoryId,
    analysisId,
    currentTimestep,
    onSave
}: ExpressionSelectStageEditorProps) => {
    const { config, patch } = useStageConfig<ExpressionSelectStageConfig>(stageId, trajectoryId);

    const action = config?.action ?? 'color';
    const color = config?.color ?? DEFAULT_EXPRESSION_SELECT_COLOR;
    const [draft, setDraft] = useState(config?.expression ?? '');

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

    const handleApply = () => {
        patch({ expression: draft });
        onSave?.();
    };

    const handleClear = () => {
        setDraft('');
        patch({ expression: '' });
    };

    const hasExpression = draft.trim().length > 0;

    return (
        <div className='flex flex-col gap-2 expression-select-chip'>
            <span className='text-xs text-muted'>Boolean expression over atom columns</span>
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
                onFieldChange={(_, value) => patch({ action: String(value) as ExpressionSelectAction })}
                options={ACTION_OPTIONS}
                variant='canvas'
            />

            {action === 'color' && (
                <div className='flex flex-row items-center gap-2'>
                    <span className='text-xs text-muted'>Highlight color</span>
                    <input
                        type='color'
                        className='expression-select-chip__color'
                        value={color}
                        onChange={(e) => patch({ color: e.target.value })}
                        aria-label='Selection highlight color'
                    />
                </div>
            )}

            {hasExpression && !autoRoute && (
                <div className='flex flex-row items-center gap-2'>
                    {isValid && matchCount !== null && (
                        <span className='text-xs text-muted expression-select-chip__match-count'>
                            {matchCount} atoms {action === 'delete' ? 'will be deleted' : 'selected'}
                        </span>
                    )}
                    {!isValid && error && (
                        <span className='text-xs text-muted expression-select-chip__error'>
                            {error}
                        </span>
                    )}
                </div>
            )}
            {autoRoute && (
                <span className='text-xs text-muted'>
                    Large dataset — route to daemon on apply
                </span>
            )}
            <div className='flex flex-row items-center gap-2'>
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
            </div>
        </div>
    );
};

export default ExpressionSelectStageEditor;
