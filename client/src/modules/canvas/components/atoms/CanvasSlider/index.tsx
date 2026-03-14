import './CanvasSlider.css';

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
    ariaLabel,
    min,
    max,
    value,
    onChange,
    step = 1,
    disabled = false,
    ariaValueText
}: CanvasSliderProps) => (
    <input
        className="canvas-slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={ariaValueText}
    />
);

export default CanvasSlider;
