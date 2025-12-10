import React from 'react';

export interface NodeFieldProps{
    label: string;
    value?: string | number | boolean;
    code?: boolean;
    empty?: string;
};

const NodeField = ({ label, value, code, empty }: NodeFieldProps) => {
    return (
        <div className='workflow-node-field-container'>
            <div className='workflow-node-field-label-container'>
                <h3 className='workflow-node-field-label'>{label}</h3>
            </div>
            <p className={`workflow-node-value ${!value ? 'workflow-node-value--empty' : ''} ${code ? 'workflow-node-value--code' : ''}`}>
                {value !== undefined && value !== '' ? String(value) : empty}
            </p>
        </div>
    );
};

export default NodeField;