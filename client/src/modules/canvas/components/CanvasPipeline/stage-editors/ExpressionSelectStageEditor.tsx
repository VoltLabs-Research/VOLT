import useStageConfig from '@/modules/canvas/hooks/use-stage-config';
import useExpressionSelect from '../../../hooks/use-expression-select';
import { trajectoryAtomsQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import { Button } from '@heroui/react';
import {
    CODE_INPUT_CLASS,
    EXPRESSION_CHIP_CLASS,
    EXPRESSION_CHIP_COLOR_CLASS,
    EXPRESSION_CHIP_ERROR_CLASS,
    EXPRESSION_CHIP_INPUT_CLASS,
    EXPRESSION_CHIP_MATCH_COUNT_CLASS
} from '../pipeline-classes';
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
        <div className={`flex flex-col gap-2 ${EXPRESSION_CHIP_CLASS}`}>
            <span className='text-xs text-muted'>Boolean expression over atom columns</span>
            <textarea
                className={`${CODE_INPUT_CLASS} ${EXPRESSION_CHIP_INPUT_CLASS}`}
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
                        className={EXPRESSION_CHIP_COLOR_CLASS}
                        value={color}
                        onChange={(e) => patch({ color: e.target.value })}
                        aria-label='Selection highlight color'
                    />
                </div>
            )}

            {hasExpression && !autoRoute && (
                <div className='flex flex-row items-center gap-2'>
                    {isValid && matchCount !== null && (
                        <span className={`text-xs text-muted ${EXPRESSION_CHIP_MATCH_COUNT_CLASS}`}>
                            {matchCount} atoms {action === 'delete' ? 'will be deleted' : 'selected'}
                        </span>
                    )}
                    {!isValid && error && (
                        <span className={`text-xs ${EXPRESSION_CHIP_ERROR_CLASS}`}>
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
                    variant='primary'
                    size='sm'
                    onPress={handleApply}
                    isDisabled={!hasExpression || (!autoRoute && !isValid)}
                >
                    Apply
                </Button>
                {hasExpression && (
                    <Button
                        variant='ghost'
                        size='sm'
                        onPress={handleClear}
                    >
                        Clear
                    </Button>
                )}
            </div>
        </div>
    );
};

export default ExpressionSelectStageEditor;
