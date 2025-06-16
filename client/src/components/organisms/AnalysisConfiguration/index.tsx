import React, { useState } from 'react';
import { IoIosArrowDown } from 'react-icons/io';
import FormField from '../../molecules/FormField';
import EditorWidget from '../EditorWidget';
import './AnalysisConfiguration.css';

const AnalysisConfiguration: React.FC = () => {
    const [config, setConfig] = useState({
        cna_cutoff: 3.5,
        pbc: '1,1,1',
        offset: '0,0,0',
        scale: '1,1,1',
        maxcircuitsize: 12,
        extcircuitsize: 14,
        smoothsurface: 8,
        smoothlines: 1,
        coarsenlines: 1,
        flattensf: 0.0
    });

    const configFields = [
        { key: 'cna_cutoff', label: 'CNA Cutoff Radius', inputProps: { type: 'number', step: '0.1' }},
        { key: 'pbc', label: 'Periodic Boundaries (X,Y,Z)', inputProps: { type: 'text', placeholder: '1,1,0' }},
        { key: 'offset', label: 'Atom Position Offset (X,Y,Z)', inputProps: { type: 'text', placeholder: '0,0,0' }},
        { key: 'scale', label: 'Cell Scaling Factors (X,Y,Z)', inputProps: { type: 'text', placeholder: '1,1,1' }},
        { key: 'maxcircuitsize', label: 'Max Circuit Size', inputProps: { type: 'number', step: '1' }},
        { key: 'extcircuitsize', label: 'Extended Circuit Size', inputProps: { type: 'number', step: '1' }},
        { key: 'smoothsurface', label: 'Surface Smoothing', inputProps: { type: 'number', step: '1' }},
        { key: 'smoothlines', label: 'Line Smoothing', inputProps: { type: 'number', step: '1' }},
        { key: 'coarsenlines', label: 'Line Coarsening', inputProps: { type: 'number', step: '1' }},
        { key: 'flattensf', label: 'Stacking Fault Flattening', inputProps: { type: 'number', step: '0.01' }},
    ];

    const handleChange = (key: string, value: string | number) => {
        setConfig(prev => ({
            ...prev,
            [key]: value
        }));
    };

    return (
        <EditorWidget className='editor-analysis-config'>
            <div className='editor-analysis-config-header-container'>
                <h3 className='editor-analysis-config-header-title'>Analysis Configuration</h3>
                <IoIosArrowDown />
            </div>

            <div className='editor-analysis-config-body-container'>
                {configFields.map((field) => (
                    <FormField
                        key={field.key}
                        label={field.label}
                        fieldKey={field.key}
                        inputProps={field.inputProps}
                        field={config} // ✅ Cambié 'config' por 'field'
                        onFieldChange={handleChange}
                    />
                ))}
            </div>
        </EditorWidget>
    );
};

export default AnalysisConfiguration;