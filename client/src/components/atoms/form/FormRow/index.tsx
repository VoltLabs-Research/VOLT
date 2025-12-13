import Slider from '@/components/atoms/form/Slider';
import './FormRow.css';

const FormRow = ({
    label,
    value,
    onChange,
    min,
    max,
    step,
    format = (v) => `${v}`,
    className,
}) => {

    return(
        <div className={`form-control-row ${className ?? ''}`}>
            <label className='labeled-input-label'>{label}</label>

            <div className='form-control-row-slider-container'>
                <Slider
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={onChange} />
                <span className='form-control-value'>{format(value)}</span>
            </div>
        </div>
    );
};

export default FormRow;
