import React, { useState } from 'react';
import { IoIosArrowDown } from 'react-icons/io';
import FormField from '../../molecules/FormField';
import EditorWidget from '../EditorWidget';
import './AnalysisConfiguration.css';

const AnalysisConfiguration: React.FC = () => {
    const [internalConfig, setInternalConfig] = useState({
        cutoffDistance: 0,
        neighbors: 0,
        latticeParameter: 0,
        maxLoopLength: 0,
        burgersThreshold: 0,
        tolerance: 0,
        crystal_type: 'auto'
    });

    const configFields = [
        {
            key: 'cutoffDistance',
            label: 'Cutoff Distance',
            inputProps: {
                type: 'number',
                step: '0.1'
            }
        },
        {
            key: 'neighbors',
            label: 'Neighbors',
            inputProps: {
                type: 'number'
            }
        },
        {
            key: 'latticeParameter',
            label: 'Lattice Parameter (Å)',
            inputProps: {
                type: 'number',
                step: '0.1'
            }
        },
        {
            key: 'maxLoopLength',
            label: 'Maximum Loop Length',
            inputProps: {
                type: 'number'
            }
        },
        {
            key: 'burgersThreshold',
            label: 'Burgers Threshold',
            inputProps: {
                type: 'number',
                step: '1e-5'
            }
        },
        {
            key: 'tolerance',
            label: 'Tolerance',
            inputProps: {
                type: 'number',
                step: '0.01'
            }
        },
        {
            key: 'crystalType',
            label: 'Crystal Type',
            inputProps: {
                type: 'select',
                options: [
                    { value: 'fcc', title: 'FCC' },
                    { value: 'bcc', title: 'BCC' },
                    { value: 'hcp', title: 'HCP' },
                    { value: 'auto', title: 'Auto' }
                ]
            }
        },
        {
            key: 'fastMode',
            label: 'Fast Mode',
            inputProps: {
                type: 'select',
                options: [
                    { value: 'yes', title: 'Yes' },
                    { value: 'no', title: 'No' }
                ]
            }
        },
        {
            key: 'allowNonStandardBurgers',
            label: 'Allow Non-Standard Burger Vectors',
            inputProps: {
                type: 'select',
                options: [
                    { value: 'enabled', title: 'Enabled' },
                    { value: 'disabled', title: 'Disabled' }
                ]
            }
        },
        {
            key: 'includeSegments',
            label: 'Include Segments',
            inputProps: {
                type: 'select',
                options: [
                    { value: 'include', title: 'Include' },
                    { value: 'exclude', title: 'Exclude' }
                ]
            }
        }
    ];

    const handleChange = (key: string, value: any) => {
        setInternalConfig(prev => ({
            ...prev,
            [key]: value
        }));
    };

    return (
        <EditorWidget className='editor-analysis-config'>
            <div className='editor-analysis-config-header-container'>
                <h3 className='editor-analysis-config-header-title'>Analysis</h3>
                <IoIosArrowDown />
            </div>

            <div className='editor-analysis-config-body-container'>
                {configFields.map((field, index) => (
                    <FormField
                        key={index}
                        label={field.label}
                        fieldKey={field.key}
                        inputProps={field.inputProps}
                        field={internalConfig}
                        onFieldChange={handleChange}
                    />
                ))}
            </div>
        </EditorWidget>
    );
};

export default AnalysisConfiguration;