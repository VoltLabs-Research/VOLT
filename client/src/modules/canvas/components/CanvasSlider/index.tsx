import Slider from '@/shared/presentation/primitives/Slider';

interface CanvasSliderProps {
    ariaLabel: string;
    min: number;
    max: number;
    value: number;
    onChange: (value: number) => void;
    step?: number;
    disabled?: boolean;
    ariaValueText?: string;
};

const CanvasSlider = ({
    min,
    max,
    value,
    onChange,
    step = 1,
    disabled = false
}: CanvasSliderProps) => (
    <Slider
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        disabled={disabled}
    />
);

export default CanvasSlider;
