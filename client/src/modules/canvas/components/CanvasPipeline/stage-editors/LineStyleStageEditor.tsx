import { Button, Checkbox, Row, Stack, Text } from '@voltstack/bravais';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import { COLORMAP_NAMES } from '@/modules/fractal/services/colormaps';
import useLineStyle from '../../../hooks/use-line-style';
import './LineStyleStageEditor.css';

import type { ColormapName } from '@/modules/fractal/services/colormaps';
import type { LineColorMode, LineStyleFilterRow } from '../../../hooks/use-line-style';

interface LineStyleStageEditorProps {
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
    canMutateCanvas?: boolean;
}

const COLOR_MODE_OPTIONS = [
    { value: 'category', title: 'Category' },
    { value: 'uniform', title: 'Uniform color' },
    { value: 'gradient', title: 'Gradient' }
];

const FILTER_OPERATOR_OPTIONS = [
    { value: 'gte', title: '>=' },
    { value: 'lte', title: '<=' }
];

const isColorMode = (value: string): value is LineColorMode =>
    COLOR_MODE_OPTIONS.some((option) => option.value === value);

const isFilterOperator = (value: string): value is LineStyleFilterRow['operator'] =>
    FILTER_OPERATOR_OPTIONS.some((option) => option.value === value);

const isColormapName = (value: string): value is ColormapName =>
    COLORMAP_NAMES.some((name) => name === value);

const formatPropertyValue = (value: unknown): string => {
    if (typeof value === 'number') {
        if (Number.isInteger(value)) return String(value);
        return String(Number(value.toFixed(4)));
    }
    if (Array.isArray(value)) {
        return value.map(formatPropertyValue).join(', ');
    }
    return String(value ?? '');
};

/**
 * Line-style pipeline stage. Restyles line-entity results (OpenDXA / ILDA
 * dislocations etc.) — per-value visibility, category/uniform/gradient color,
 * tube width, property filters — by baking a re-colored line GLB on the daemon
 * (lineStyleService.apply). The styleable property catalog comes from the
 * exposure's DECLARED `properties` (line exposures are excluded from per-atom
 * discovery). Like Color Coding, it bakes on its own Apply button and is not
 * part of the ordered pipeline run.
 */
const LineStyleStageEditor = ({
    trajectoryId,
    analysisId,
    currentTimestep,
    canMutateCanvas
}: LineStyleStageEditorProps) => {
    const {
        hasLineSource,
        colorMode,
        setColorMode,
        stringProperties,
        numberProperties,
        categoryProperty,
        setCategoryProperty,
        categoryOptions,
        isLoadingCategories,
        categoryCounts,
        hiddenCategories,
        toggleCategory,
        uniformColorHex,
        setUniformColorHex,
        gradientProperty,
        setGradientProperty,
        gradient,
        setGradient,
        startInput,
        setStartInput,
        endInput,
        setEndInput,
        filterRows,
        addFilterRow,
        removeFilterRow,
        updateFilterRow,
        lineWidthInput,
        setLineWidthInput,
        isApplying,
        handleApply,
        error,
        entityIdInput,
        setEntityIdInput,
        handleInspect,
        isInspecting,
        inspectedEntity,
        inspectError
    } = useLineStyle({ trajectoryId, analysisId, currentTimestep });

    if (!hasLineSource) {
        return (
            <Stack gap='05'>
                <Text size='xs' tone='muted'>
                    Select a line result (e.g. OpenDXA dislocations) in Visual Elements
                    first — this stage restyles line entities (per-value visibility,
                    colors, tube width).
                </Text>
            </Stack>
        );
    }

    const stringPropertyOptions = stringProperties.map((property) => ({ value: property.name, title: property.label }));
    const numberPropertyOptions = numberProperties.map((property) => ({ value: property.name, title: property.label }));
    const gradientOptions = COLORMAP_NAMES.map((name) => ({ value: name, title: name }));

    return (
        <Stack gap='05'>
            <FormFieldRHF
                fieldKey='line-color-mode'
                fieldType='select'
                label='Color by'
                fieldValue={colorMode}
                onFieldChange={(_fieldKey, value) => {
                    const nextValue = String(value);
                    if (isColorMode(nextValue)) setColorMode(nextValue);
                }}
                options={COLOR_MODE_OPTIONS}
                variant='canvas'
            />

            {colorMode === 'category' && (
                <>
                    <FormFieldRHF
                        fieldKey='line-category-property'
                        fieldType='select'
                        label='Property'
                        fieldValue={categoryProperty}
                        onFieldChange={(_fieldKey, value) => setCategoryProperty(String(value))}
                        options={stringPropertyOptions}
                        variant='canvas'
                    />
                    <Stack gap='025'>
                        <Text size='xs' tone='muted'>Values</Text>
                        {isLoadingCategories && (
                            <Text size='xs' tone='muted'>Loading values...</Text>
                        )}
                        {!isLoadingCategories && categoryOptions.length === 0 && (
                            <Text size='xs' tone='muted'>No values found for this frame.</Text>
                        )}
                        {categoryOptions.map((option) => {
                            const count = categoryCounts?.[option.value];
                            return (
                                <Row key={option.value} justify='between' gap='05'>
                                    <Checkbox
                                        checked={!hiddenCategories[option.value]}
                                        onChange={() => toggleCategory(option.value)}
                                        label={(
                                            <span className='canvas-line-category-label'>
                                                <span className='canvas-line-category-swatch' style={{ background: option.swatch }} />
                                                {option.value}
                                            </span>
                                        )}
                                    />
                                    {count !== undefined && (
                                        <Text size='xs' tone='muted'>{count}</Text>
                                    )}
                                </Row>
                            );
                        })}
                    </Stack>
                </>
            )}

            {colorMode === 'uniform' && (
                <Row gap='05'>
                    <Text size='xs' tone='muted'>Color</Text>
                    <input
                        type='color'
                        value={uniformColorHex}
                        onChange={(event) => setUniformColorHex(event.target.value)}
                        aria-label='Uniform line color'
                    />
                </Row>
            )}

            {colorMode === 'gradient' && (
                <>
                    <FormFieldRHF
                        fieldKey='line-gradient-property'
                        fieldType='select'
                        label='Property'
                        fieldValue={gradientProperty}
                        onFieldChange={(_fieldKey, value) => setGradientProperty(String(value))}
                        options={numberPropertyOptions}
                        variant='canvas'
                    />
                    <FormFieldRHF
                        fieldKey='line-gradient'
                        fieldType='select'
                        label='Gradient'
                        fieldValue={gradient}
                        onFieldChange={(_fieldKey, value) => {
                            const nextValue = String(value);
                            if (isColormapName(nextValue)) setGradient(nextValue);
                        }}
                        options={gradientOptions}
                        variant='canvas'
                    />
                    <FormFieldRHF
                        fieldKey='line-gradient-start'
                        fieldType='input'
                        label='Start value'
                        fieldValue={startInput}
                        onFieldChange={(_fieldKey, value) => setStartInput(String(value))}
                        inputProps={{ inputMode: 'decimal' }}
                        variant='canvas'
                    />
                    <FormFieldRHF
                        fieldKey='line-gradient-end'
                        fieldType='input'
                        label='End value'
                        fieldValue={endInput}
                        onFieldChange={(_fieldKey, value) => setEndInput(String(value))}
                        inputProps={{ inputMode: 'decimal' }}
                        variant='canvas'
                    />
                </>
            )}

            <Stack gap='025'>
                <Text size='xs' tone='muted'>Filters</Text>
                {filterRows.map((row) => (
                    <Stack key={row.id} gap='025'>
                        <FormFieldRHF
                            fieldKey={`line-filter-property-${row.id}`}
                            fieldType='select'
                            label='Property'
                            fieldValue={row.property}
                            onFieldChange={(_fieldKey, value) => updateFilterRow(row.id, { property: String(value) })}
                            options={numberPropertyOptions}
                            variant='canvas'
                        />
                        <FormFieldRHF
                            fieldKey={`line-filter-operator-${row.id}`}
                            fieldType='select'
                            label='Operator'
                            fieldValue={row.operator}
                            onFieldChange={(_fieldKey, value) => {
                                const nextValue = String(value);
                                if (isFilterOperator(nextValue)) updateFilterRow(row.id, { operator: nextValue });
                            }}
                            options={FILTER_OPERATOR_OPTIONS}
                            variant='canvas'
                        />
                        <FormFieldRHF
                            fieldKey={`line-filter-value-${row.id}`}
                            fieldType='input'
                            label='Value'
                            fieldValue={row.valueInput}
                            onFieldChange={(_fieldKey, value) => updateFilterRow(row.id, { valueInput: String(value) })}
                            inputProps={{ inputMode: 'decimal' }}
                            variant='canvas'
                        />
                        <Button
                            variant='solid'
                            intent='danger'
                            shape='rounded'
                            size='sm'
                            block
                            onClick={() => removeFilterRow(row.id)}
                            className='font-size-05'
                        >
                            Remove Filter
                        </Button>
                    </Stack>
                ))}
                <Button
                    variant='ghost'
                    shape='rounded'
                    size='sm'
                    block
                    onClick={addFilterRow}
                    className='font-size-05'
                >
                    Add Filter
                </Button>
            </Stack>

            <FormFieldRHF
                fieldKey='line-width'
                fieldType='input'
                label='Line width (Å, empty = default)'
                fieldValue={lineWidthInput}
                onFieldChange={(_fieldKey, value) => setLineWidthInput(String(value))}
                inputProps={{ inputMode: 'decimal' }}
                variant='canvas'
            />

            {error && <Text as='div' size='xs' tone='muted' className='canvas-filter-error'>{error}</Text>}

            <Button
                isLoading={isApplying}
                variant='solid'
                intent='brand'
                shape='rounded'
                size='sm'
                block
                onClick={() => { void handleApply(); }}
                disabled={isApplying || !canMutateCanvas || currentTimestep === undefined}
                className='font-size-05'
            >
                Apply (bake)
            </Button>

            <Stack gap='025'>
                <Text size='xs' tone='muted'>Inspect entity</Text>
                <FormFieldRHF
                    fieldKey='line-entity-id'
                    fieldType='input'
                    label='Entity id'
                    fieldValue={entityIdInput}
                    onFieldChange={(_fieldKey, value) => setEntityIdInput(String(value))}
                    inputProps={{ inputMode: 'numeric' }}
                    variant='canvas'
                />
                <Button
                    isLoading={isInspecting}
                    variant='ghost'
                    shape='rounded'
                    size='sm'
                    block
                    onClick={() => { void handleInspect(); }}
                    disabled={isInspecting}
                    className='font-size-05'
                >
                    Inspect
                </Button>
                {inspectError && <Text as='div' size='xs' tone='muted' className='canvas-filter-error'>{inspectError}</Text>}
                {inspectedEntity && (
                    <Stack gap='025'>
                        {Object.entries(inspectedEntity.properties).map(([key, value]) => (
                            <Row key={key} justify='between' gap='05'>
                                <Text size='xs' tone='muted'>{key}</Text>
                                <Text size='xs'>{formatPropertyValue(value)}</Text>
                            </Row>
                        ))}
                    </Stack>
                )}
            </Stack>
        </Stack>
    );
};

export default LineStyleStageEditor;
