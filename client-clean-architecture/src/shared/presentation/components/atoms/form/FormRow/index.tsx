import Slider from '@/shared/presentation/components/atoms/form/Slider';
import Container from '@/shared/presentation/components/primitives/Container';
import '@/shared/presentation/components/atoms/form/FormRow/FormRow.css';

interface FormRowProps {
    label: string;
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    step?: number;
    format?: (value: number) => string;
    className?: string;
}

const FormRow = ({
    label,
    value,
    onChange,
    min,
    max,
    step,
    format = (v) => `${v}`,
    className,
}: FormRowProps) => {

    return(
        <Container className={`d-flex items-center content-between ${className ?? ''}`}>
            <label className='labeled-input-label font-weight-4'>{label}</label>

            <Container className='d-flex items-center gap-02'>
                <Slider
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={onChange} />
                <span className='form-control-value color-muted'>{format(value)}</span>
            </Container>
        </Container>
    );
};

export default FormRow;
