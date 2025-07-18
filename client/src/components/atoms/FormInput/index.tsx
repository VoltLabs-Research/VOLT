import React from 'react';
import './FormInput.css';

const FormInput = ({ label, ...props }) => {

    return (
        <div className='form-input-wrapper-container'>
            <label className='form-input-label-container'>
                <h3 className='form-input-label'>{label}</h3>
            </label>

            <div className='form-input-container'>
                <input className='form-input' {...props} />
            </div>
        </div>
    );
};

export default FormInput;