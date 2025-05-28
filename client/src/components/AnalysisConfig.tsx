import React, { useState } from 'react';
import type { AnalysisConfig } from '../types/index';
import { IoIosArrowDown } from 'react-icons/io';

interface AnalysisConfigProps{
    config: AnalysisConfig;
    onChange: (config: AnalysisConfig) => void;
}

const AnalysisConfig: React.FC = () => {
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

    const renderInput = (field: any) => {
        const { key, inputProps } = field;
        
        if (inputProps.type === 'select') {
            return (
                <select
                    value={internalConfig[key as keyof typeof internalConfig] || ''}
                    onChange={(e) => handleChange(key, e.target.value)}
                    className='labeled-input'
                >
                    {inputProps.options?.map((option: any) => (
                        <option key={option.value} value={option.value}>
                            {option.title}
                        </option>
                    ))}
                </select>
            );
        }

        return (
            <input
                {...inputProps}
                value={internalConfig[key as keyof typeof internalConfig] || ''}
                onChange={(e) => handleChange(key, 
                    inputProps.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value
                )}
                className='labeled-input'
            />
        );
    };

    return (
        <div className='editor-floating-container editor-analysis-config'>
            <div className='editor-analysis-config-header-container'>
                <h3 className='editor-analysis-config-header-title'>Analysis</h3>
                <IoIosArrowDown />
            </div>

            <div className='editor-analysis-config-body-container'>
                {configFields.map((field, index) => (
                    <div className='labeled-input-container' key={index}>
                        <h4 className='labeled-input-label'>{field.label}</h4>
                        <div className='labeled-input-tag-container'>
                            {renderInput(field)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AnalysisConfig;
