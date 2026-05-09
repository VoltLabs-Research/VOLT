import useParticleFilter, {
    ACTIONS,
    MATCH_MODES,
    OPERATORS,
    FilterAction,
    FilterOperator
} from '../../hooks/use-particle-filter';
import Button from '@/shared/presentation/primitives/Button';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import { ParticleFilterCombinator } from '@/modules/trajectory/api/services/particle-filter-service';

import './ParticleFilter.css';

interface ParticleFilterProps {
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
}

const isFilterOperator = (value: string): value is FilterOperator => {
    return OPERATORS.some((option) => option.value === value);
};

const isFilterAction = (value: string): value is FilterAction => {
    return ACTIONS.some((option) => option.value === value);
};

const isParticleFilterCombinator = (value: string): value is ParticleFilterCombinator => {
    return MATCH_MODES.some((option) => option.value === value);
};

const ParticleFilter = ({ trajectoryId, analysisId, currentTimestep }: ParticleFilterProps) => {
    const {
        conditions,
        addCondition,
        removeCondition,
        handlePropertyChange,
        handleOperatorChange,
        handleValueChange,
        propertyOptions,
        matchMode,
        setMatchMode,
        action,
        setAction,
        fetchValueSuggestions,
        getValueSuggestions,
        isLoadingValueSuggestions,
        previewResult,
        isLoadingPreview,
        handlePreview,
        handleCancelPreview,
        percentage,
        canPreview,
        isApplying,
        handleApplyAction,
        error
    } = useParticleFilter({
        trajectoryId,
        analysisId,
        currentTimestep
    });

    const handleActionFieldChange = (_fieldKey: string, value: unknown) => {
        const nextValue = String(value);
        if (!isFilterAction(nextValue)) {
            return;
        }

        setAction(nextValue);
    };

    const handleMatchModeFieldChange = (_fieldKey: string, value: unknown) => {
        const nextValue = String(value);
        if (!isParticleFilterCombinator(nextValue)) {
            return;
        }

        setMatchMode(nextValue);
    };

    const renderConditionRow = (condition: typeof conditions[number], index: number) => {
        const isRemovable = conditions.length > 1;

        return (
            <Stack key={condition.id} gap='05' className='canvas-filter-condition'>
                <Row justify='between' gap='05'>
                    <Text size='xs' className='color-text-secondary'>Condition {index + 1}</Text>
                    {isRemovable && (
                        <Button
                            variant='solid'
                            intent='danger'
                            shape='rounded'
                            size='sm'
                            onClick={() => removeCondition(condition.id)}
                            className='font-size-05'
                        >
                            Remove
                        </Button>
                    )}
                </Row>

                <FormFieldRHF
                    fieldKey={`property-${condition.id}`}
                    fieldType='select'
                    label='Property'
                    fieldValue={condition.propertyValue}
                    onFieldChange={(_fieldKey, value) => handlePropertyChange(condition.id, String(value))}
                    options={propertyOptions}
                    variant='canvas'
                />

                <FormFieldRHF
                    fieldKey={`operator-${condition.id}`}
                    fieldType='select'
                    label='Operator'
                    fieldValue={condition.operator}
                    onFieldChange={(_fieldKey, value) => {
                        const nextValue = String(value);
                        if (!isFilterOperator(nextValue)) {
                            return;
                        }

                        handleOperatorChange(condition.id, nextValue);
                    }}
                    options={OPERATORS}
                    variant='canvas'
                />

                <FormFieldRHF
                    fieldKey={`value-${condition.id}`}
                    fieldType='input'
                    onFieldChange={(_fieldKey, value) => handleValueChange(condition.id, String(value))}
                    fieldValue={condition.valueInput}
                    label='Value'
                    suggestions={getValueSuggestions(condition.id)}
                    onFetchSuggestions={() => fetchValueSuggestions(condition.id)}
                    isLoading={isLoadingValueSuggestions}
                    inputProps={{ inputMode: 'decimal' }}
                    variant='canvas'
                />
            </Stack>
        );
    };

    const renderPreviewSection = () => {
        if (!previewResult) {
            return null;
        }

        return (
            <Stack gap='05' className='canvas-filter-panel'>
                <Stack gap='05' radius='sm' className='canvas-filter-preview'>
                    <Row justify='between'>
                        <span>Selection</span>
                        <span className='color-primary'>{percentage}% of total</span>
                    </Row>
                </Stack>

                <FormFieldRHF
                    fieldKey='action'
                    fieldType='select'
                    label='Action'
                    fieldValue={action}
                    onFieldChange={handleActionFieldChange}
                    options={ACTIONS}
                    variant='canvas'
                />

                {error && <div className='canvas-filter-error font-size-05'>{error}</div>}

                <Stack gap='025'>
                    <Button
                        isLoading={isApplying}
                        variant='solid'
                        intent={action === FilterAction.Delete ? 'danger' : 'brand'}
                        block
                        onClick={handleApplyAction}
                        disabled={isApplying}
                        shape='rounded'
                        size='sm'
                        className='font-size-05'
                    >
                        {action === FilterAction.Delete ? 'Delete Selection' : 'Apply Color'}
                    </Button>
                    <Button
                        variant='solid'
                        intent='canvas'
                        shape='rounded'
                        size='sm'
                        block
                        onClick={handleCancelPreview}
                        disabled={isApplying}
                        className='font-size-05'
                    >
                        Cancel
                    </Button>
                </Stack>
            </Stack>
        );
    };

    return (
        <Stack gap='05' className='canvas-filter-panel'>
            {!previewResult && (
                <>
                    <FormFieldRHF
                        fieldKey='match-mode'
                        fieldType='select'
                        label='Combine'
                        fieldValue={matchMode}
                        onFieldChange={handleMatchModeFieldChange}
                        options={MATCH_MODES}
                        variant='canvas'
                    />

                    <Stack gap='05'>
                        {conditions.map(renderConditionRow)}
                    </Stack>

                    <Button
                        variant='solid'
                        intent='canvas'
                        shape='rounded'
                        size='sm'
                        block
                        onClick={addCondition}
                        className='font-size-05'
                    >
                        Add Condition
                    </Button>

                    {error && <div className='canvas-filter-error font-size-05'>{error}</div>}

                    <Button
                        isLoading={isLoadingPreview}
                        variant='solid'
                        intent='brand'
                        shape='rounded'
                        size='sm'
                        block
                        onClick={handlePreview}
                        disabled={!canPreview}
                        className='font-size-05'
                    >
                        Preview
                    </Button>
                </>
            )}

            {renderPreviewSection()}
        </Stack>
    );
};

export default ParticleFilter;
