import Slider from '@/components/atoms/form/Slider';
import Container from '@/components/primitives/Container';
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
        <Container className={`d-flex items-center content-between ${className ?? ''}`}>
            <label className='labeled-input-label font-weight-4'>{label}</label>

            <Container className='flex items-center gap-02'>
                <Slider
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={onChange} />
                <span className='form-control-value'>{format(value)}</span>
            </Container>
        </Container>
    );
};

export default FormRow;
