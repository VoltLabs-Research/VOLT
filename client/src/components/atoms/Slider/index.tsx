import React from 'react';

interface SliderProps {
    min: number;
    max: number;
    value: number;
    onChange: (value: number) => void;
    step?: number;
    disabled?: boolean;
    className?: string;
    style?: React.CSSProperties;
}

const Slider: React.FC<SliderProps> = ({
    min,
    max,
    value,
    onChange,
    step = 1,
    disabled = false,
    className = '',
    style = {}
}) => {
    return (
        <input
            type="range"
            min={min}
            max={max}
            value={value}
            step={step}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            disabled={disabled}
            className={className}
            style={style}
        />
    );
};

export default Slider;