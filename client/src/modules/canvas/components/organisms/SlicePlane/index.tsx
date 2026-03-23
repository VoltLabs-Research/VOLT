import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import useSlicePlane from '../../../hooks/use-slice-plane';

const SlicePlane = () => {
    const {
        enabled,
        distanceInput,
        normalInputs,
        reverseOrientation,
        visualizePlane,
        handleEnabledChange,
        handleDistanceChange,
        handleNormalChange,
        handleReverseOrientationChange,
        handleVisualizePlaneChange
    } = useSlicePlane();

    return (
        <Container className="canvas-slice-plane d-flex column gap-05">
            <Container className="d-flex items-center content-between gap-05">
                <span className="font-size-05 color-muted">Coordinates</span>
                <span className="font-size-05 color-secondary">Cartesian Coordinates</span>
            </Container>

            <FormFieldRHF
                fieldKey="slice-plane-enabled"
                fieldType="checkbox"
                label="Enabled"
                fieldValue={enabled}
                onFieldChange={handleEnabledChange}
                variant="canvas"
            />

            <FormFieldRHF
                fieldKey="slice-plane-distance"
                fieldType="input"
                label="Distance"
                fieldValue={distanceInput}
                onFieldChange={handleDistanceChange}
                inputProps={{ inputMode: 'decimal' }}
                variant="canvas"
            />

            <FormFieldRHF
                fieldKey="slice-plane-normal-x"
                fieldType="input"
                label="Normal X"
                fieldValue={normalInputs.x}
                onFieldChange={handleNormalChange('x')}
                inputProps={{ inputMode: 'decimal' }}
                variant="canvas"
            />

            <FormFieldRHF
                fieldKey="slice-plane-normal-y"
                fieldType="input"
                label="Normal Y"
                fieldValue={normalInputs.y}
                onFieldChange={handleNormalChange('y')}
                inputProps={{ inputMode: 'decimal' }}
                variant="canvas"
            />

            <FormFieldRHF
                fieldKey="slice-plane-normal-z"
                fieldType="input"
                label="Normal Z"
                fieldValue={normalInputs.z}
                onFieldChange={handleNormalChange('z')}
                inputProps={{ inputMode: 'decimal' }}
                variant="canvas"
            />

            <FormFieldRHF
                fieldKey="slice-plane-reverse-orientation"
                fieldType="checkbox"
                label="Reverse Orientation"
                fieldValue={reverseOrientation}
                onFieldChange={handleReverseOrientationChange}
                variant="canvas"
            />

            <FormFieldRHF
                fieldKey="slice-plane-visualize-plane"
                fieldType="checkbox"
                label="Visualize Plane"
                fieldValue={visualizePlane}
                onFieldChange={handleVisualizePlaneChange}
                variant="canvas"
            />
        </Container>
    );
};

export default SlicePlane;
