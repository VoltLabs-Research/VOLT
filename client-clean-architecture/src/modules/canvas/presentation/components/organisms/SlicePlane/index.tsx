/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
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

import EditorWidget from '@/modules/canvas/presentation/components/organisms/EditorWidget';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import Container from '@/shared/presentation/components/primitives/Container';
import '@/modules/canvas/presentation/components/organisms/SlicePlane/SlicePlane.css';
import Title from '@/shared/presentation/components/primitives/Title';
import FormField from '@/shared/presentation/components/molecules/form/FormField';

const SlicePlane = () => {
    const slicePlaneConfig = useEditorStore((state) => state.configuration.slicePlaneConfig);
    const setSlicePlaneConfig = useEditorStore((state) => state.configuration.setSlicePlaneConfig);

    const handleNormalChange = (axis: 'x' | 'y' | 'z', value: string) => {
        const v = Number.isNaN(parseFloat(value)) ? 0 : parseFloat(value);
        setSlicePlaneConfig({ normal: { [axis]: v } as any });
    };

    return (
        <EditorWidget className='slice-plane-container d-flex column overflow-hidden' draggable={false}>
            <Container className='d-flex content-between items-center'>
                <Title className='font-weight-5-5'>Slice Modifier</Title>
            </Container>

            <Container className='d-flex column gap-1'>
                <Container className='d-flex content-between items-center gap-05'>
                    <span className='slice-plane-normals-title'>Normals</span>
                    <Container className='d-flex gap-05'>
                        {(['x', 'y', 'z'] as const).map((axis, index) => (
                            <Container className='d-flex gap-05 content-between' key={index}>
                                <Container className='d-flex items-center gap-1 slice-plane-normal-input-container'>
                                    <span className='slice-plane-normal-input-label'>{axis}</span>
                                    <input
                                        value={slicePlaneConfig.normal[axis]}
                                        onChange={(e) => handleNormalChange(axis, e.target.value)}
                                        className='slice-plane-normal-input'
                                        step={0.01}
                                        type='number'
                                    />
                                </Container>
                            </Container>
                        ))}
                    </Container>
                </Container>

                <Container className='d-flex column gap-1'>
                    {[
                        ['Slab Width', slicePlaneConfig.slabWidth, 'slabWidth', 0.01],
                        ['Distance', slicePlaneConfig.distance, 'distance', 0.1]
                    ].map(([inputTitle, value, keyName, step], index) => (
                        <Container className='d-flex gap-05 content-between' key={index}>
                            <span>{inputTitle}</span>
                            <Container className='d-flex items-center gap-1 slice-plane-normal-input-container'>
                                <input
                                    value={value as number}
                                    onChange={(e) => setSlicePlaneConfig({ [keyName as 'slabWidth' | 'distance']: e.currentTarget.valueAsNumber })}
                                    className='slice-plane-normal-input-extended'
                                    step={step as number}
                                    type='number'
                                />
                            </Container>
                        </Container>
                    ))}
                    <Container className='d-flex content-between items-center'>
                        <span>Reverse Orientation</span>
                        <FormField
                            label="Reverse Orientation"
                            fieldKey="reverseOrientation"
                            fieldType='checkbox'
                            fieldValue={slicePlaneConfig.reverseOrientation}
                            onFieldChange={(_, v) => setSlicePlaneConfig({ reverseOrientation: v })} />
                    </Container>
                </Container>
            </Container>
        </EditorWidget>
    );
};

export default SlicePlane;
