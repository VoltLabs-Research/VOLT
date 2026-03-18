import useParticleFilter, { ACTIONS, MATCH_MODES, OPERATORS, FilterAction, FilterOperator } from '../../../hooks/use-particle-filter';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import { ParticleFilterCombinator } from '@/modules/trajectory/api/dtos/particle-filter';

import './ParticleFilter.css';

interface ParticleFilterProps {
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
};

interface FilterConditionViewModel {
    id: string;
    propertyValue: string;
    operator: FilterOperator;
    valueInput: string;
};

interface ConditionFieldHandlers {
    handleRemoveCondition: () => void;
    handlePropertyFieldChange: (_fieldKey: string, value: unknown) => void;
    handleOperatorFieldChange: (_fieldKey: string, value: unknown) => void;
    handleValueFieldChange: (_fieldKey: string, value: unknown) => void;
    handleFetchSuggestions: () => void;
};

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
        propertyOptions,
        conditions,
        addCondition,
        removeCondition,
        handlePropertyChange,
        handleOperatorChange,
        handleValueChange,
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

    const conditionViewModels: FilterConditionViewModel[] = conditions.map((condition) => ({
        id: condition.id,
        propertyValue: condition.propertyValue,
        operator: condition.operator,
        valueInput: condition.valueInput
    }));

    const createConditionFieldHandlers = (conditionId: string): ConditionFieldHandlers => {
        const handleRemoveCondition = () => {
            removeCondition(conditionId);
        };

        const handlePropertyFieldChange = (_fieldKey: string, value: unknown) => {
            handlePropertyChange(conditionId, String(value));
        };

        const handleOperatorFieldChange = (_fieldKey: string, value: unknown) => {
            const nextValue = String(value);
            if (!isFilterOperator(nextValue)) {
                return;
            }

            handleOperatorChange(conditionId, nextValue);
        };

        const handleValueFieldChange = (_fieldKey: string, value: unknown) => {
            handleValueChange(conditionId, String(value));
        };

        const handleFetchSuggestions = () => {
            fetchValueSuggestions(conditionId);
        };

        return {
            handleRemoveCondition,
            handlePropertyFieldChange,
            handleOperatorFieldChange,
            handleValueFieldChange,
            handleFetchSuggestions
        };
    };

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

    const renderConditionRow = (condition: FilterConditionViewModel, index: number) => {
        const isRemovable = conditionViewModels.length > 1;
        const handlers = createConditionFieldHandlers(condition.id);

        return (
            <Container key={condition.id} className='canvas-filter-condition d-flex column gap-05'>
                <Container className='d-flex items-center content-between gap-05'>
                    <span className='font-size-05 color-text-secondary'>Condition {index + 1}</span>
                    {isRemovable && (
                        <Button
                            variant='ghost'
                            intent='danger'
                            shape='rounded'
                            size='sm'
                            onClick={handlers.handleRemoveCondition}
                            className='font-size-05'
                        >
                            Remove
                        </Button>
                    )}
                </Container>

                <FormFieldRHF
                    fieldKey={`property-${condition.id}`}
                    fieldType='select'
                    label='Property'
                    fieldValue={condition.propertyValue}
                    onFieldChange={handlers.handlePropertyFieldChange}
                    options={propertyOptions}
                    variant='canvas'
                />

                <FormFieldRHF
                    fieldKey={`operator-${condition.id}`}
                    fieldType='select'
                    label='Operator'
                    fieldValue={condition.operator}
                    onFieldChange={handlers.handleOperatorFieldChange}
                    options={OPERATORS}
                    variant='canvas'
                />

                <FormFieldRHF
                    fieldKey={`value-${condition.id}`}
                    fieldType='input'
                    onFieldChange={handlers.handleValueFieldChange}
                    fieldValue={condition.valueInput}
                    label='Value'
                    suggestions={getValueSuggestions(condition.id)}
                    onFetchSuggestions={handlers.handleFetchSuggestions}
                    isLoading={isLoadingValueSuggestions}
                    inputProps={{ inputMode: 'decimal' }}
                    variant='canvas'
                />
            </Container>
        );
    };

    const renderPreviewSection = () => {
        if (!previewResult) {
            return null;
        }

        return (
            <Container className='canvas-filter-panel d-flex column gap-05'>
                <Container className='canvas-filter-preview radius-sm d-flex column gap-05'>
                    <Container className='d-flex content-between'>
                        <span>Selection</span>
                        <span className='color-primary'>{percentage}% of total</span>
                    </Container>
                </Container>

                <FormFieldRHF
                    fieldKey='action'
                    fieldType='select'
                    label='Action'
                    fieldValue={action}
                    onFieldChange={handleActionFieldChange}
                    options={ACTIONS}
                    variant='canvas'
                />

                {error && <Container className='canvas-filter-error font-size-05'>{error}</Container>}

                <Container className='d-flex column gap-025'>
                    <Button
                        isLoading={isApplying}
                        variant='solid'
                        intent={action === FilterAction.Delete ? 'danger' : 'canvas'}
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
                        variant='ghost'
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
                </Container>
            </Container>
        );
    };

    return (
        <Container className='canvas-filter-panel d-flex column gap-05'>
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

                    <Container className='d-flex column gap-05'>
                        {conditionViewModels.map(renderConditionRow)}
                    </Container>

                    <Button
                        variant='ghost'
                        intent='canvas'
                        shape='rounded'
                        size='sm'
                        block
                        onClick={addCondition}
                        className='font-size-05'
                    >
                        Add Condition
                    </Button>

                    {error && <Container className='canvas-filter-error font-size-05'>{error}</Container>}

                    <Button
                        isLoading={isLoadingPreview}
                        variant='soft'
                        intent='canvas'
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
        </Container>
    );
};

export default ParticleFilter;
