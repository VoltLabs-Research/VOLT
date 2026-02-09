import React from 'react';
import Container from '@/shared/presentation/components/Container';
import useSlicePlane, { AXES } from '../../../hooks/use-slice-plane';
import AxisButtons from '../../atoms/AxisButtons';
import AxisConfig from '../../molecules/AxisConfig';

const SlicePlane = () => {
    const {
        slicePlaneConfig,
        handleAxisClick,
        handlePositionChange,
        handleAngleChange,
        isAxisActive
    } = useSlicePlane();

    return (
        <Container className="canvas-slice-plane d-flex column gap-1">
            <AxisButtons axes={AXES} isAxisActive={isAxisActive} onAxisClick={handleAxisClick} />
            {slicePlaneConfig.activeAxes.map((axis) => (
                <AxisConfig
                    key={axis}
                    axis={axis}
                    position={slicePlaneConfig.positions[axis]}
                    angle={slicePlaneConfig.angles[axis]}
                    onPositionChange={handlePositionChange}
                    onAngleChange={handleAngleChange}
                />
            ))}
            {slicePlaneConfig.activeAxes.length === 0 && (
                <span className="font-size-05 color-muted">Select an axis to add a clipping plane</span>
            )}
        </Container>
    );
};

export default SlicePlane;
