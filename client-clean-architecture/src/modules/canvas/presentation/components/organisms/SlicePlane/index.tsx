import React, { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import EditorWidget from '@/modules/canvas/presentation/components/organisms/EditorWidget';
import { useEditorStore } from '@/modules/fractal/presentation/stores/editor';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Slider from '@/shared/presentation/components/Slider';
import type { SliceAxis } from '@/modules/fractal/presentation/types/configuration';
import '@/modules/canvas/presentation/components/organisms/SlicePlane/SlicePlane.css';

const AXES: SliceAxis[] = ['x', 'y', 'z'];

const SlicePlane: React.FC = () => {
    const {
        slicePlaneConfig,
        toggleSliceAxis,
        setSlicePosition,
        setSliceAngle
    } = useEditorStore(useShallow((s) => ({
        slicePlaneConfig: s.configuration.slicePlaneConfig,
        toggleSliceAxis: s.configuration.toggleSliceAxis,
        setSlicePosition: s.configuration.setSlicePosition,
        setSliceAngle: s.configuration.setSliceAngle
    })));

    const handleAxisClick = useCallback((axis: SliceAxis) => {
        toggleSliceAxis(axis);
    }, [toggleSliceAxis]);

    const handlePositionChange = useCallback((axis: SliceAxis, value: number) => {
        setSlicePosition(axis, value);
    }, [setSlicePosition]);

    const handleAngleChange = useCallback((axis: SliceAxis, value: number) => {
        setSliceAngle(axis, value);
    }, [setSliceAngle]);

    const isAxisActive = useCallback((axis: SliceAxis) => {
        return slicePlaneConfig.activeAxes.includes(axis);
    }, [slicePlaneConfig.activeAxes]);

    return (
        <EditorWidget className='slice-plane-container p-1 d-flex column gap-1 overflow-hidden' draggable={false}>
            <Title className='font-weight-5-5'>Slice Plane</Title>

            <Container className='slice-plane-axis-buttons'>
                {AXES.map((axis) => (
                    <button
                        key={axis}
                        className={`slice-plane-axis-btn ${isAxisActive(axis) ? 'active' : ''}`}
                        onClick={() => handleAxisClick(axis)}
                    >
                        {axis.toUpperCase()}
                    </button>
                ))}
            </Container>

            {slicePlaneConfig.activeAxes.map((axis) => (
                <Container key={axis} className='slice-plane-axis-config d-flex column gap-025'>
                    <Container className='d-flex content-between items-center'>
                        <span className='slice-plane-axis-label'>{axis.toUpperCase()} Axis</span>
                    </Container>

                    <Container className='d-flex content-between items-center'>
                        <span className='slice-plane-slider-label'>Position</span>
                        <Container className='d-flex items-center gap-05'>
                            <Slider
                                min={-10}
                                max={10}
                                step={0.01}
                                value={slicePlaneConfig.positions[axis]}
                                onChange={(value) => handlePositionChange(axis, value)}
                            />
                            <span className='slice-plane-slider-value'>{slicePlaneConfig.positions[axis].toFixed(2)}</span>
                        </Container>
                    </Container>

                    {axis !== 'x' && (
                        <Container className='d-flex content-between items-center'>
                            <span className='slice-plane-slider-label'>Angle</span>
                            <Container className='d-flex items-center gap-05'>
                                <Slider
                                    min={-90}
                                    max={90}
                                    step={1}
                                    value={slicePlaneConfig.angles[axis]}
                                    onChange={(value) => handleAngleChange(axis, value)}
                                />
                                <span className='slice-plane-slider-value'>{slicePlaneConfig.angles[axis].toFixed(0)}°</span>
                            </Container>
                        </Container>
                    )}
                </Container>
            ))}

            {slicePlaneConfig.activeAxes.length === 0 && (
                <span className='slice-plane-hint color-tertiary font-size-1'>
                    Select an axis to add a clipping plane
                </span>
            )}
        </EditorWidget>
    );
};

export default SlicePlane;
