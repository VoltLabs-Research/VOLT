/**
 * Copyright(c) 2025, Volt Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import React, { useCallback } from 'react';
import EditorWidget from '@/features/canvas/components/organisms/EditorWidget';
import { useEditorStore } from '@/features/canvas/stores/editor';
import Container from '@/components/primitives/Container';
import Title from '@/components/primitives/Title';
import Slider from '@/components/atoms/form/Slider';
import type { SliceAxis } from '@/types/stores/editor/configuration';
import '@/features/canvas/components/organisms/SlicePlane/SlicePlane.css';

const AXES: SliceAxis[] = ['x', 'y', 'z'];

const SlicePlane: React.FC = () => {
    const slicePlaneConfig = useEditorStore((s) => s.configuration.slicePlaneConfig);
    const toggleSliceAxis = useEditorStore((s) => s.configuration.toggleSliceAxis);
    const setSlicePosition = useEditorStore((s) => s.configuration.setSlicePosition);
    const setSliceAngle = useEditorStore((s) => s.configuration.setSliceAngle);

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
