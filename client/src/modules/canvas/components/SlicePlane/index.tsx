import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import useSlicePlane from '../../hooks/use-slice-plane';

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
        <div className='flex flex-col gap-2 canvas-slice-plane'>
            <div className='flex flex-row items-center justify-between gap-2'>
                <span className='text-xs text-muted'>Coordinates</span>
                <span className='text-xs text-muted'>Cartesian Coordinates</span>
            </div>

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
        </div>
    );
};

export default SlicePlane;
