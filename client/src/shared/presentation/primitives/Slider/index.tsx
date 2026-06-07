import './Slider.css';
import { usePrefersReducedMotion } from '@/shared/presentation/hooks/use-prefers-reduced-motion';
import { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

export interface SliderProps {
    min: number;
    max: number;
    value: number;
    onChange: (value: number) => void;
    step?: number;
    disabled?: boolean;
    className?: string;
    style?: CSSProperties;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const getStepDecimals = (step: number) => {
    const s = step.toString();
    if(s.includes('e-')) return parseInt(s.split('e-')[1], 10);
    const i = s.indexOf('.');
    return i === -1 ? 0 : s.length - i - 1;
};

const snapToStep = (raw: number, min: number, step: number, decimals: number) =>
    Number((Math.round((raw - min) / step) * step + min).toFixed(decimals));

const Slider = forwardRef<HTMLDivElement, SliderProps>(({
    min,
    max,
    value,
    onChange,
    step = 1,
    disabled = false,
    className = '',
    style
}, ref) => {
    const trackRef = useRef<HTMLDivElement | null>(null);
    const auraKeyRef = useRef(0);

    const [isDragging, setIsDragging] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [auraPulseKey, setAuraPulseKey] = useState(0);
    const prefersReducedMotion = usePrefersReducedMotion();

    const decimals = useMemo(() => getStepDecimals(step), [step]);
    const ratioFromValue = useCallback(
        (v: number) => (max === min ? 0 : clamp((v - min) / (max - min), 0, 1)),
        [min, max]
    );

    const ratio = ratioFromValue(value);

    const updateFromClientX = useCallback((clientX: number) => {
        if(!trackRef.current || disabled) return;
        const rect = trackRef.current.getBoundingClientRect();
        const r = clamp((clientX - rect.left) / rect.width, 0, 1);
        const raw = min + r * (max - min);
        const next = clamp(snapToStep(raw, min, step, decimals), min, max);
        onChange(next);
    }, [disabled, min, max, step, decimals, onChange]);

    const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if(disabled) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        setIsDragging(true);
        updateFromClientX(e.clientX);
    }, [disabled, updateFromClientX]);

    const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if(!isDragging || disabled) return;
        updateFromClientX(e.clientX);
    }, [isDragging, disabled, updateFromClientX]);

    const finishDrag = useCallback((target: HTMLDivElement, pointerId: number) => {
        target.releasePointerCapture?.(pointerId);
        setIsDragging(false);
    }, []);

    const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if(!isDragging) return;
        finishDrag(e.currentTarget, e.pointerId);
    }, [isDragging, finishDrag]);

    const onPointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if(!isDragging) return;
        finishDrag(e.currentTarget, e.pointerId);
    }, [isDragging, finishDrag]);

    const onLostCapture = useCallback(() => {
        if(isDragging) setIsDragging(false);
    }, [isDragging]);

    const onMouseEnter = useCallback(() => {
        if(disabled || isDragging) return;
        setIsHovered(true);
    }, [disabled, isDragging]);

    const onMouseLeave = useCallback(() => {
        if(disabled || isDragging) return;
        setIsHovered(false);
    }, [disabled, isDragging]);

    const triggerAuraPulse = useCallback(() => {
        if (prefersReducedMotion) return;
        auraKeyRef.current += 1;
        setAuraPulseKey(auraKeyRef.current);
    }, [prefersReducedMotion]);

    const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        if(disabled) return;
        let next = value;
        const coarse = step * 10;
        switch(e.key){
            case 'ArrowLeft':
            case 'ArrowDown':
                e.preventDefault();
                next = clamp(value - step, min, max);
                break;
            case 'ArrowRight':
            case 'ArrowUp':
                e.preventDefault();
                next = clamp(value + step, min, max);
                break;
            case 'PageDown':
                e.preventDefault();
                next = clamp(value - coarse, min, max);
                break;
            case 'PageUp':
                e.preventDefault();
                next = clamp(value + coarse, min, max);
                break;
            case 'Home':
                e.preventDefault();
                next = min;
                break;
            case 'End':
                e.preventDefault();
                next = max;
                break;
            default:
                return;
        }
        next = snapToStep(next, min, step, decimals);
        triggerAuraPulse();
        onChange(next);
    }, [disabled, value, step, min, max, decimals, onChange, triggerAuraPulse]);

    // Ensure hover state resets if disabled toggles on mid-hover.
    useEffect(() => {
        if (disabled) {
            setIsHovered(false);
            setIsDragging(false);
        }
    }, [disabled]);

    const trackStyle = {
        '--slider-ratio': ratio,
        '--slider-ring-a': isDragging ? 1 : (isHovered ? 0.5 : 0),
        '--slider-ring-b': isDragging ? 1 : 0,
        '--slider-elev': isDragging ? 1 : 0,
        '--slider-scale': isDragging ? 1.05 : (isHovered ? 1.02 : 1),
        '--slider-aura-opacity': isDragging ? 1 : 0,
        '--slider-aura-scale': isDragging ? 1.1 : 1,
        '--slider-aura-intensity': isDragging ? 0.5 : 0,
        '--slider-sheen-opacity': isDragging ? 1 : 0
    } as CSSProperties;

    return (
        <div ref={ref} className={`slider slider--ios ${disabled ? 'slider--disabled' : ''} ${className || ''} u-select-none`} style={style} aria-disabled={disabled || undefined} data-disabled={disabled || undefined}>
            <div
                ref={trackRef}
                className='slider__track p-relative w-max overflow-hidden cursor-pointer'
                role='slider'
                aria-valuemin={min}
                aria-valuemax={max}
                aria-valuenow={value}
                aria-valuetext={`${value}`}
                tabIndex={disabled ? -1 : 0}
                data-dragging={isDragging || undefined}
                data-hovered={isHovered || undefined}
                style={trackStyle}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
                onLostPointerCapture={onLostCapture}
                onKeyDown={onKeyDown}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
            >
                <div className='slider__progress p-absolute inset-0'>
                    <div className='slider__gloss p-absolute' />
                    <div className='slider__sheen p-absolute' data-running={isDragging || undefined} />
                    <div
                        className='slider__aura p-absolute'
                        key={auraPulseKey}
                        data-pulse={auraPulseKey > 0 || undefined}
                    />
                    <div className='slider__sparkles p-absolute overflow-hidden inset-0'>
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                    </div>
                    <div className='slider__noise p-absolute inset-0' />
                </div>
            </div>
        </div>
    );
});

Slider.displayName = 'Slider';

export default memo(Slider);
