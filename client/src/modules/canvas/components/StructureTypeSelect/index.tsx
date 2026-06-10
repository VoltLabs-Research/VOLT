import useStructureTypeSelect from '../../hooks/use-structure-type-select';
import { ACTIONS, FilterAction } from '../../hooks/use-particle-filter';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import { Button, Checkbox, Row, Stack, Text } from '@voltstack/bravais';

import './StructureTypeSelect.css';

interface StructureTypeSelectProps {
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
}

const isFilterAction = (value: string): value is FilterAction => {
    return ACTIONS.some((option) => option.value === value);
};

const StructureTypeSelect = ({ trajectoryId, analysisId, currentTimestep }: StructureTypeSelectProps) => {
    const {
        hasStructureSource,
        sourceOptions,
        sourceValue,
        handleSourceChange,
        structureTypes,
        isLoadingTypes,
        selected,
        toggleType,
        action,
        handleActionChange,
        previewResult,
        isLoadingPreview,
        handlePreview,
        handleCancelPreview,
        percentage,
        canPreview,
        isApplying,
        handleApply,
        error
    } = useStructureTypeSelect({
        trajectoryId,
        analysisId,
        currentTimestep
    });

    if (!hasStructureSource) {
        return (
            <Stack gap='05' className='canvas-filter-panel'>
                <Text size='xs' className='color-text-secondary'>
                    Run a structure identification analysis (PTM, ACNA, DXA) first — this
                    modifier selects atoms by their identified structure type.
                </Text>
            </Stack>
        );
    }

    const handleActionFieldChange = (_fieldKey: string, value: unknown) => {
        const nextValue = String(value);
        if (!isFilterAction(nextValue)) {
            return;
        }

        handleActionChange(nextValue);
    };

    return (
        <Stack gap='05' className='canvas-filter-panel'>
            {!previewResult && (
                <>
                    {sourceOptions.length > 1 && (
                        <FormFieldRHF
                            fieldKey='structure-source'
                            fieldType='select'
                            label='Source'
                            fieldValue={sourceValue}
                            onFieldChange={(_fieldKey, value) => handleSourceChange(String(value))}
                            options={sourceOptions}
                            variant='canvas'
                        />
                    )}

                    <Stack gap='025' className='canvas-structure-type-list'>
                        <Text size='xs' className='color-text-secondary'>Structure types</Text>
                        {isLoadingTypes && (
                            <Text size='xs' className='color-text-secondary'>Loading types...</Text>
                        )}
                        {!isLoadingTypes && structureTypes.length === 0 && (
                            <Text size='xs' className='color-text-secondary'>No structure types found for this frame.</Text>
                        )}
                        {structureTypes.map((typeName) => (
                            <Checkbox
                                key={typeName}
                                checked={Boolean(selected[typeName])}
                                onChange={() => toggleType(typeName)}
                                label={typeName}
                            />
                        ))}
                    </Stack>

                    {error && <Text as='div' size='xs' className='canvas-filter-error'>{error}</Text>}

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
                        Preview Selection
                    </Button>
                </>
            )}

            {previewResult && (
                <Stack gap='05'>
                    <Stack gap='05' radius='sm' className='canvas-filter-preview'>
                        <Row justify='between'>
                            <span>Selection</span>
                            <Text as='span' tone='primary'>{percentage}% of total</Text>
                        </Row>
                    </Stack>

                    <FormFieldRHF
                        fieldKey='structure-action'
                        fieldType='select'
                        label='Action'
                        fieldValue={action}
                        onFieldChange={handleActionFieldChange}
                        options={ACTIONS}
                        variant='canvas'
                    />

                    {error && <Text as='div' size='xs' className='canvas-filter-error'>{error}</Text>}

                    <Stack gap='025'>
                        <Button
                            isLoading={isApplying}
                            variant='solid'
                            intent={action === FilterAction.Delete ? 'danger' : 'brand'}
                            block
                            onClick={handleApply}
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
            )}
        </Stack>
    );
};

export default StructureTypeSelect;
