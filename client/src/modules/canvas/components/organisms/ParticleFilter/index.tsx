import useParticleFilter, {
    ACTIONS,
    CONDITION_TYPES,
    MATCH_MODES,
    OPERATORS,
    PRESETS,
    SURFACE_CUTOFF_MODES,
    FilterAction,
    FilterOperator
} from '../../../hooks/use-particle-filter';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import {
    ParticleFilterCombinator,
    ParticleFilterConditionKind,
    ParticleFilterPreset,
    SurfaceAtomsCutoffMode
} from '@/modules/trajectory/api/dtos/particle-filter';

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

const isParticleFilterConditionKind = (value: string): value is ParticleFilterConditionKind => {
    return CONDITION_TYPES.some((option) => option.value === value);
};

const isParticleFilterPreset = (value: string): value is ParticleFilterPreset => {
    return PRESETS.some((option) => option.value === value);
};

const isSurfaceAtomsCutoffMode = (value: string): value is SurfaceAtomsCutoffMode => {
    return SURFACE_CUTOFF_MODES.some((option) => option.value === value);
};

const ParticleFilter = ({ trajectoryId, analysisId, currentTimestep }: ParticleFilterProps) => {
    const {
        conditions,
        addCondition,
        removeCondition,
        handleConditionKindChange,
        handlePropertyChange,
        handleOperatorChange,
        handleValueChange,
        handlePresetChange,
        handleSurfaceLayersChange,
        handleSurfaceCutoffModeChange,
        handleSurfaceCutoffRadiusChange,
        handleSurfaceCoordinationDeficitChange,
        handleSurfaceAnisotropyThresholdChange,
        handleSurfaceByTypeChange,
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
            <Container key={condition.id} className='canvas-filter-condition d-flex column gap-05'>
                <Container className='d-flex items-center content-between gap-05'>
                    <span className='font-size-05 color-text-secondary'>Condition {index + 1}</span>
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
                </Container>

                <FormFieldRHF
                    fieldKey={`condition-kind-${condition.id}`}
                    fieldType='select'
                    label='Condition Type'
                    fieldValue={condition.kind}
                    onFieldChange={(_fieldKey, value) => {
                        const nextValue = String(value);
                        if (!isParticleFilterConditionKind(nextValue)) {
                            return;
                        }

                        handleConditionKindChange(condition.id, nextValue);
                    }}
                    options={CONDITION_TYPES}
                    variant='canvas'
                />

                {condition.kind === ParticleFilterConditionKind.Property && (
                    <>
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
                    </>
                )}

                {condition.kind === ParticleFilterConditionKind.Preset && (
                    <>
                        <FormFieldRHF
                            fieldKey={`preset-${condition.id}`}
                            fieldType='select'
                            label='Preset'
                            fieldValue={condition.preset}
                            onFieldChange={(_fieldKey, value) => {
                                const nextValue = String(value);
                                if (!isParticleFilterPreset(nextValue)) {
                                    return;
                                }

                                handlePresetChange(condition.id, nextValue);
                            }}
                            options={PRESETS}
                            variant='canvas'
                        />

                        <Container className='font-size-05 color-text-secondary'>
                            Detects surface atoms from local coordination loss and directional anisotropy.
                        </Container>

                        <FormFieldRHF
                            fieldKey={`surface-layers-${condition.id}`}
                            fieldType='input'
                            label='Layers'
                            fieldValue={condition.presetState.layersInput}
                            onFieldChange={(_fieldKey, value) => handleSurfaceLayersChange(condition.id, String(value))}
                            inputProps={{ inputMode: 'numeric' }}
                            variant='canvas'
                        />

                        <FormFieldRHF
                            fieldKey={`surface-cutoff-mode-${condition.id}`}
                            fieldType='select'
                            label='Cutoff'
                            fieldValue={condition.presetState.cutoffMode}
                            onFieldChange={(_fieldKey, value) => {
                                const nextValue = String(value);
                                if (!isSurfaceAtomsCutoffMode(nextValue)) {
                                    return;
                                }

                                handleSurfaceCutoffModeChange(condition.id, nextValue);
                            }}
                            options={SURFACE_CUTOFF_MODES}
                            variant='canvas'
                        />

                        {condition.presetState.cutoffMode === SurfaceAtomsCutoffMode.Manual && (
                            <FormFieldRHF
                                fieldKey={`surface-cutoff-radius-${condition.id}`}
                                fieldType='input'
                                label='Cutoff Radius'
                                fieldValue={condition.presetState.cutoffRadiusInput}
                                onFieldChange={(_fieldKey, value) => handleSurfaceCutoffRadiusChange(condition.id, String(value))}
                                inputProps={{ inputMode: 'decimal' }}
                                variant='canvas'
                            />
                        )}

                        <FormFieldRHF
                            fieldKey={`surface-coordination-deficit-${condition.id}`}
                            fieldType='input'
                            label='Coordination Deficit'
                            fieldValue={condition.presetState.coordinationDeficitInput}
                            onFieldChange={(_fieldKey, value) => handleSurfaceCoordinationDeficitChange(condition.id, String(value))}
                            inputProps={{ inputMode: 'numeric' }}
                            variant='canvas'
                        />

                        <FormFieldRHF
                            fieldKey={`surface-anisotropy-threshold-${condition.id}`}
                            fieldType='input'
                            label='Relative Anisotropy Threshold'
                            fieldValue={condition.presetState.anisotropyThresholdInput}
                            onFieldChange={(_fieldKey, value) => handleSurfaceAnisotropyThresholdChange(condition.id, String(value))}
                            inputProps={{ inputMode: 'decimal' }}
                            variant='canvas'
                        />

                        <FormFieldRHF
                            fieldKey={`surface-by-type-${condition.id}`}
                            fieldType='checkbox'
                            label='Estimate bulk coordination by atom type'
                            fieldValue={condition.presetState.byType}
                            onFieldChange={(_fieldKey, value) => handleSurfaceByTypeChange(condition.id, value === true || value === 'true')}
                            variant='canvas'
                        />
                    </>
                )}
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
                        {conditions.map(renderConditionRow)}
                    </Container>

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

                    {error && <Container className='canvas-filter-error font-size-05'>{error}</Container>}

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
        </Container>
    );
};

export default ParticleFilter;
