/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
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

import EditorWidget from '@/components/organisms/scene/EditorWidget';
import useConfigurationStore from '@/stores/editor/configuration';
import './SlicePlane.css';

const SlicePlane = () => {
    const slicePlaneConfig = useConfigurationStore((state) => state.slicePlaneConfig);
    const setSlicePlaneConfig = useConfigurationStore((state) => state.setSlicePlaneConfig);

    const handleNormalChange = (axis: 'x' | 'y' | 'z', value: string) => {
        const v = Number.isNaN(parseFloat(value)) ? 0 : parseFloat(value);
        setSlicePlaneConfig({ normal: { [axis]: v } as any });
    };

    return (
        <EditorWidget className='slice-plane-container' draggable={false}>
            <div className='editor-floting-header-container'>
                <h3 className='editor-floating-header-title'>Slice Modifier</h3>
            </div>

            <div className='slice-plane-body-container'>
                <div className='slice-plane-normals-container'>
                    <span className='slice-plane-normals-title'>Normals</span>
                    <div className='slice-plane-normals-inputs-container'>
                        {(['x','y','z'] as const).map((axis, index) => (
                            <div className='slice-plane-normals-inputs' key={index}>
                                <div className='slice-plane-normal-input-container'>
                                    <span className='slice-plane-normal-input-label'>{axis}</span>
                                    <input
                                        value={slicePlaneConfig.normal[axis]}
                                        onChange={(e) => handleNormalChange(axis, e.target.value)}
                                        className='slice-plane-normal-input'
                                        step={0.01}
                                        type='number'
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className='slice-plane-params-container'>
                    {[
                        ['Slab Width', slicePlaneConfig.slabWidth, 'slabWidth', 0.01],
                        ['Distance', slicePlaneConfig.distance, 'distance', 0.1]
                    ].map(([ inputTitle, value, keyName, step ], index) => (
                        <div className='slice-plane-normals-inputs extended' key={index}>
                            <span className='slice-plane-param-input-title'>{inputTitle}</span>
                            <div className='slice-plane-normal-input-container'>
                                <input
                                    value={value as number}
                                    onChange={(e) => setSlicePlaneConfig({ [keyName as 'slabWidth'|'distance']: e.currentTarget.valueAsNumber })}
                                    className='slice-plane-normal-input'
                                    step={step as number}
                                    type='number'
                                />
                            </div>
                        </div>
                    ))}
                    <div className='slice-plane-normals-inputs extended'>
                        <span className='slice-plane-param-input-title'>Reverse Orientation</span>
                        <div className='slice-plane-normal-input-container'>
                            <input
                                type='checkbox'
                                className='slice-plane-toggle'
                                checked={slicePlaneConfig.reverseOrientation}
                                onChange={(e) => setSlicePlaneConfig({ reverseOrientation: e.currentTarget.checked })}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </EditorWidget>
    );
};

export default SlicePlane;
