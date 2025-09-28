import Slider from '@/components/atoms/form/Slider';

const SliderRow = ({
    label,
    value,
    onChange,
    min,
    max,
    step,
    format = (v) => `${v}`,
    className,
}) => {

    return (
        <div className={`form-control-row ${className ?? ''}`}>
            <label className='form-control-label'>{label}</label>
            <Slider
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={onChange} />
            <span className='form-control-value'>{format(value)}</span>
        </div>
    );
};

export default SliderRow;