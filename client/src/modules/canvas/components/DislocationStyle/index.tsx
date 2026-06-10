import useDislocationStyle from '../../hooks/use-dislocation-style';
import { COLORMAP_NAMES } from '@/modules/fractal/services/colormaps';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import { Button, Checkbox, Row, Stack, Text } from '@voltstack/bravais';

import type { ColormapName } from '@/modules/fractal/services/colormaps';
import type { DislocationColorMode, DislocationColorProperty } from '../../hooks/use-dislocation-style';

import './DislocationStyle.css';

interface DislocationStyleProps {
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
}

const COLOR_MODE_OPTIONS = [
    { value: 'family', title: 'Burgers family' },
    { value: 'property', title: 'Property' },
    { value: 'uniform', title: 'Uniform color' }
];

const PROPERTY_OPTIONS = [
    { value: 'length', title: 'Segment length' },
    { value: 'magnitude', title: 'Burgers magnitude' }
];

const isColorMode = (value: string): value is DislocationColorMode => {
    return COLOR_MODE_OPTIONS.some((option) => option.value === value);
};

const isColorProperty = (value: string): value is DislocationColorProperty => {
    return PROPERTY_OPTIONS.some((option) => option.value === value);
};

const isColormapName = (value: string): value is ColormapName => {
    return COLORMAP_NAMES.some((name) => name === value);
};

const DislocationStyle = ({ trajectoryId, analysisId, currentTimestep }: DislocationStyleProps) => {
    const {
        hasDislocationSource,
        familyOptions,
        familyCounts,
        hiddenFamilies,
        toggleFamily,
        colorMode,
        setColorMode,
        uniformColorHex,
        setUniformColorHex,
        property,
        setProperty,
        gradient,
        setGradient,
        lineWidthInput,
        setLineWidthInput,
        minLengthInput,
        setMinLengthInput,
        isApplying,
        handleApply,
        error
    } = useDislocationStyle({
        trajectoryId,
        analysisId,
        currentTimestep
    });

    if (!hasDislocationSource) {
        return (
            <Stack gap='05' className='canvas-filter-panel'>
                <Text size='xs' className='color-text-secondary'>
                    Add a DXA "Dislocations" result to the scene first — this modifier
                    restyles dislocation lines (family visibility, colors, tube width).
                </Text>
            </Stack>
        );
    }

    const gradientOptions = COLORMAP_NAMES.map((name) => ({ value: name, title: name }));

    return (
        <Stack gap='05' className='canvas-filter-panel'>
            <Stack gap='025' className='canvas-dislocation-family-list'>
                <Text size='xs' className='color-text-secondary'>Burgers families</Text>
                {familyOptions.map((option) => {
                    const summary = familyCounts?.[option.family];
                    return (
                        <Row key={option.family} justify='between' gap='05' className='canvas-dislocation-family-row'>
                            <Checkbox
                                checked={!hiddenFamilies[option.family]}
                                onChange={() => toggleFamily(option.family)}
                                label={(
                                    <span className='canvas-dislocation-family-label'>
                                        <span className='canvas-dislocation-family-swatch' style={{ background: option.swatch }} />
                                        {option.label}
                                    </span>
                                )}
                            />
                            {summary && (
                                <Text size='xs' className='color-text-secondary canvas-dislocation-family-count'>
                                    {summary.count} · {summary.totalLength.toFixed(1)} Å
                                </Text>
                            )}
                        </Row>
                    );
                })}
            </Stack>

            <FormFieldRHF
                fieldKey='dislocation-color-mode'
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

            {colorMode === 'uniform' && (
                <Row gap='05' className='canvas-dislocation-uniform-color'>
                    <Text size='xs' className='color-text-secondary'>Color</Text>
                    <input
                        type='color'
                        value={uniformColorHex}
                        onChange={(event) => setUniformColorHex(event.target.value)}
                        aria-label='Uniform dislocation color'
                    />
                </Row>
            )}

            {colorMode === 'property' && (
                <>
                    <FormFieldRHF
                        fieldKey='dislocation-property'
                        fieldType='select'
                        label='Property'
                        fieldValue={property}
                        onFieldChange={(_fieldKey, value) => {
                            const nextValue = String(value);
                            if (isColorProperty(nextValue)) setProperty(nextValue);
                        }}
                        options={PROPERTY_OPTIONS}
                        variant='canvas'
                    />
                    <FormFieldRHF
                        fieldKey='dislocation-gradient'
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
                </>
            )}

            <FormFieldRHF
                fieldKey='dislocation-line-width'
                fieldType='input'
                label='Line width (Å, empty = default)'
                fieldValue={lineWidthInput}
                onFieldChange={(_fieldKey, value) => setLineWidthInput(String(value))}
                inputProps={{ inputMode: 'decimal' }}
                variant='canvas'
            />

            <FormFieldRHF
                fieldKey='dislocation-min-length'
                fieldType='input'
                label='Min segment length (Å, empty = all)'
                fieldValue={minLengthInput}
                onFieldChange={(_fieldKey, value) => setMinLengthInput(String(value))}
                inputProps={{ inputMode: 'decimal' }}
                variant='canvas'
            />

            {error && <Text as='div' size='xs' className='canvas-filter-error'>{error}</Text>}

            <Button
                isLoading={isApplying}
                variant='solid'
                intent='brand'
                shape='rounded'
                size='sm'
                block
                onClick={handleApply}
                disabled={isApplying}
                className='font-size-05'
            >
                Apply Style
            </Button>
        </Stack>
    );
};

export default DislocationStyle;
