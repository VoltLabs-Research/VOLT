/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
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
**/

import EditorWidget from '@/components/organisms/EditorWidget';
import useConfigurationStore from '@/stores/editor/configuration';
import './SlicePlane.css';

const SlicePlane = () => {
    const slicePlaneConfig = useConfigurationStore((state) => state.slicePlaneConfig);
    const setSlicePlaneConfig = useConfigurationStore((state) => state.setSlicePlaneConfig);
    
    const handleNormalChange = (axis: 'x' | 'y' | 'z', value: string) => {
        setSlicePlaneConfig({
            ...slicePlaneConfig,
            normal: { ...slicePlaneConfig.normal, [axis]: parseFloat(value) }
        });
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
                        {['x', 'y', 'z'].map((axis, index) => (
                            <div className='slice-plane-normals-inputs' key={index}>
                                <div className='slice-plane-normal-input-container'>
                                    <span className='slice-plane-normal-input-label'>{axis}</span>
                                    <input 
                                        value={parseFloat(slicePlaneConfig.normal[axis])}
                                        onChange={(e) => handleNormalChange(axis, e.target.value)}
                                        className='slice-plane-normal-input' 
                                        step={0.01}
                                        type='number' />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className='slice-plane-params-container'>
                    {[
                        ['Slab Width', parseFloat(slicePlaneConfig.slabWidth), 'slabWidth', 0.01],
                        ['Distance', parseFloat(slicePlaneConfig.distance), 'distance', 0.1]
                    ].map(([ inputTitle, value, keyName, step ], index) => (
                        <div className='slice-plane-normals-inputs extended' key={index}>
                            <span className='slice-plane-param-input-title'>{inputTitle}</span>
                            <div className='slice-plane-normal-input-container'>
                                <input
                                    value={value}
                                    onChange={(e) => setSlicePlaneConfig({ ...slicePlaneConfig, [keyName]: e.target.value })}
                                    className='slice-plane-normal-input' 
                                    step={step}
                                    type='number'
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </EditorWidget>
    );
};

export default SlicePlane;