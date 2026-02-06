import { memo } from 'react';
import useSlicePlane, { AXES } from '@/modules/canvas/presentation/hooks/use-slice-plane';
import WidgetContainer from '@/modules/canvas/presentation/components/atoms/WidgetContainer';
import ModifierHeader from '@/modules/canvas/presentation/components/atoms/ModifierHeader';
import Container from '@/shared/presentation/components/Container';
import Slider from '@/shared/presentation/components/Slider';
import type { SliceAxis } from '@/modules/fractal/presentation/types/configuration';
import '@/modules/canvas/presentation/components/organisms/SlicePlane/SlicePlane.css';

interface AxisButtonsProps {
    axes: SliceAxis[];
    isAxisActive: (axis: SliceAxis) => boolean;
    onAxisClick: (axis: SliceAxis) => void;
}

const AxisButtons = memo(({ axes, isAxisActive, onAxisClick }: AxisButtonsProps) => (
    <Container className='d-flex gap-05'>
        {axes.map((axis) => (
            <button
                key={axis}
                className={`slice-plane-axis-btn flex-1 cursor-pointer font-weight-5 color-secondary radius-2xl transition-fast b-none ${isAxisActive(axis) ? 'active' : ''}`}
                onClick={() => onAxisClick(axis)}
            >
                {axis.toUpperCase()}
            </button>
        ))}
    </Container>
));
AxisButtons.displayName = 'AxisButtons';

interface AxisConfigProps {
    axis: SliceAxis;
    position: number;
    angle: number;
    onPositionChange: (axis: SliceAxis, value: number) => void;
    onAngleChange: (axis: SliceAxis, value: number) => void;
}

const AxisConfig = memo(({
    axis,
    position,
    angle,
    onPositionChange,
    onAngleChange
}: AxisConfigProps) => (
    <Container className='slice-plane-axis-config d-flex column gap-025'>
        <Container className='d-flex content-between items-center'>
            <span className='slice-plane-axis-label font-size-1'>{axis.toUpperCase()} Axis</span>
        </Container>

        <Container className='d-flex content-between items-center'>
            <span className='slice-plane-slider-label font-size-1'>Position</span>
            <Container className='d-flex items-center gap-05'>
                <Slider
                    min={-10}
                    max={10}
                    step={0.01}
                    value={position}
                    onChange={(value) => onPositionChange(axis, value)}
                />
                <span className='slice-plane-slider-value'>{position.toFixed(2)}</span>
            </Container>
        </Container>

        {axis !== 'x' && (
            <Container className='d-flex content-between items-center'>
                <span className='slice-plane-slider-label font-size-1'>Angle</span>
                <Container className='d-flex items-center gap-05'>
                    <Slider
                        min={-90}
                        max={90}
                        step={1}
                        value={angle}
                        onChange={(value) => onAngleChange(axis, value)}
                    />
                    <span className='slice-plane-slider-value'>{angle.toFixed(0)}°</span>
                </Container>
            </Container>
        )}
    </Container>
));
AxisConfig.displayName = 'AxisConfig';

const SlicePlane = memo(() => {
    const {
        slicePlaneConfig,
        handleAxisClick,
        handlePositionChange,
        handleAngleChange,
        isAxisActive
    } = useSlicePlane();

    return (
        <WidgetContainer className='slice-plane-container p-1 d-flex column gap-1 overflow-hidden'>
            <ModifierHeader title='Slice Plane' modifierId='slice-plane' />

            <AxisButtons
                axes={AXES}
                isAxisActive={isAxisActive}
                onAxisClick={handleAxisClick}
            />

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
                <span className='slice-plane-hint color-tertiary font-size-1'>
                    Select an axis to add a clipping plane
                </span>
            )}
        </WidgetContainer>
    );
});

SlicePlane.displayName = 'SlicePlane';

export default SlicePlane;
