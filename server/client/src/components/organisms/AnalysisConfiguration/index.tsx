import React from 'react';
import { IoIosArrowDown } from 'react-icons/io';
import FormField from '../../molecules/FormField';
import EditorWidget from '../EditorWidget';
import './AnalysisConfiguration.css';

// Interfaz para las props del componente
interface AnalysisConfigurationProps {
    config: any; // El estado de configuración
    onConfigChange: (key: string, value: any) => void; // Función para actualizar el estado
}

const AnalysisConfiguration: React.FC<AnalysisConfigurationProps> = ({ config, onConfigChange }) => {
    const configFields = [
        { 
            key: 'crystal_structure', 
            label: 'Crystal Structure', 
            type: 'select', 
            options: [
                { value: 'FCC', title: 'FCC (Face-Centered Cubic)' }, 
                { value: 'BCC', title: 'BCC (Body-Centered Cubic)' }, 
                { value: 'HCP', title: 'HCP (Hexagonal Close-Packed)' }
            ] 
        },
        { 
            key: 'identification_mode', 
            label: 'Identification Mode', 
            type: 'select', 
            options: [
                { value: 'PTM', title: 'PTM (Polyhedral Template Matching)' },
                { value: 'CNA', title: 'CNA (Common Neighbor Analysis)' }
            ] 
        },
        { key: 'max_trial_circuit_size', label: 'Max Trial Circuit Size', type: 'input', inputProps: { type: 'number', step: '0.1' }},
        { key: 'circuit_stretchability', label: 'Circuit Stretchability', type: 'input', inputProps: { type: 'number', step: '0.1' }},
        { key: 'defect_mesh_smoothing_level', label: 'Defect Mesh Smoothing', type: 'input', inputProps: { type: 'number', step: '1' }},
        { key: 'line_smoothing_level', label: 'Line Smoothing', type: 'input', inputProps: { type: 'number', step: '0.1' }},
        { key: 'line_point_interval', label: 'Line Point Interval', type: 'input', inputProps: { type: 'number', step: '0.1' }},
        { key: 'only_perfect_dislocations', label: 'Only Perfect Dislocations', type: 'checkbox' },
        { key: 'mark_core_atoms', label: 'Mark Core Atoms', type: 'checkbox' },
    ];

    const handleChange = (key: string, value: string | number | boolean) => {
        const numericKeys = [
            'max_trial_circuit_size', 'circuit_stretchability', 'defect_mesh_smoothing_level', 
            'line_smoothing_level', 'line_point_interval'
        ];
        const finalValue = numericKeys.includes(key) ? Number(value) : value;
        onConfigChange(key, finalValue);
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
                        fieldType={field.type}
                        options={field.options} 
                        inputProps={field.type === 'input' ? field.inputProps : undefined}
                        fieldValue={config[field.key]}
                        onFieldChange={handleChange}
                    />
                ))}
            </div>
        </EditorWidget>
    );
};

export default AnalysisConfiguration;