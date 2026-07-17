import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import useSlicePlane from '../../hooks/use-slice-plane';
import { Row, Stack, Text } from '@voltstack/bravais';

interface SlicePlaneProps {
    stageId: string;
    trajectoryId?: string;
}

const SlicePlane = ({ stageId, trajectoryId }: SlicePlaneProps) => {
    const {
        distanceInput,
        normalInputs,
        reverseOrientation,
        visualizePlane,
        handleDistanceChange,
        handleNormalChange,
        handleReverseOrientationChange,
        handleVisualizePlaneChange
    } = useSlicePlane(stageId, trajectoryId);

    return (
        <Stack gap='05' className="canvas-slice-plane">
            <Row justify='between' gap='05'>
                <Text size='xs' tone='muted'>Coordinates</Text>
                <Text size='xs' tone='secondary'>Cartesian Coordinates</Text>
            </Row>

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
        </Stack>
    );
};

export default SlicePlane;
