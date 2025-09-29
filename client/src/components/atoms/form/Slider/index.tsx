import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import "./Slider.css";

export interface SliderProps {
    min: number;
    max: number;
    value: number;
    onChange: (value: number) => void;
    step?: number;
    disabled?: boolean;
    className?: string;
    style?: React.CSSProperties;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const getStepDecimals = (step: number) => {
    const s = step.toString();
    if (s.includes("e-")) return parseInt(s.split("e-")[1], 10);
    const i = s.indexOf(".");
    return i === -1 ? 0 : s.length - i - 1;
};
const snapToStep = (raw: number, min: number, step: number, decimals: number) =>
    Number((Math.round((raw - min) / step) * step + min).toFixed(decimals));

const Slider: React.FC<SliderProps> = ({
    min,
    max,
    value,
    onChange,
    step = 1,
    disabled = false,
    className = "",
    style
}) => {
    const trackRef = useRef<HTMLDivElement | null>(null);
    const progressRef = useRef<HTMLDivElement | null>(null);
    const sheenRef = useRef<HTMLDivElement | null>(null);
    const auraRef = useRef<HTMLDivElement | null>(null);

    const [isDragging, setIsDragging] = useState(false);

    const setScaleXRef = useRef<((n: number) => void) | null>(null);
    const setSheenXRef = useRef<((n: number) => void) | null>(null);
    const setAuraVarRef = useRef<((n: number) => void) | null>(null);
    const qToScaleRef = useRef<ReturnType<typeof gsap.quickTo> | null>(null);
    const qToSheenRef = useRef<ReturnType<typeof gsap.quickTo> | null>(null);

    const decimals = useMemo(() => getStepDecimals(step), [step]);
    const ratioFromValue = useCallback((v: number) => (max === min ? 0 : clamp((v - min) / (max - min), 0, 1)), [min, max]);

    useLayoutEffect(() => {
        if (progressRef.current) {
            setScaleXRef.current = gsap.quickSetter(progressRef.current, "scaleX") as (n: number) => void;
            gsap.set(progressRef.current, { transformOrigin: "0% 50%" });
            qToScaleRef.current = gsap.quickTo(progressRef.current, "scaleX", { duration: 0.14, ease: "power3.out" });
        }
        if (sheenRef.current) {
            setSheenXRef.current = gsap.quickSetter(sheenRef.current, "xPercent") as (n: number) => void;
            gsap.set(sheenRef.current, { yPercent: -50 });
            qToSheenRef.current = gsap.quickTo(sheenRef.current, "xPercent", { duration: 0.14, ease: "power3.out" });
        }
        if (auraRef.current) {
            setAuraVarRef.current = (n: number) => gsap.set(auraRef.current, { "--aura": n });
        }
        const r0 = ratioFromValue(value);
        setScaleXRef.current?.(r0);
        setSheenXRef.current?.(r0 * 100);
        setAuraVarRef.current?.(0);
    }, []);

    useEffect(() => {
        const r = ratioFromValue(value);
        if (!isDragging) {
            // Kill any existing animations first
            gsap.killTweensOf([progressRef.current, sheenRef.current]);
            
            // Smooth animation when not dragging
            gsap.to(progressRef.current, {
                scaleX: r,
                duration: 0.1,
                ease: "power2.out"
            });
            gsap.to(sheenRef.current, {
                xPercent: r * 100,
                duration: 0.1,
                ease: "power2.out"
            });
        } else {
            // Direct update during drag for 60fps
            if (progressRef.current) {
                gsap.set(progressRef.current, { scaleX: r });
            }
            if (sheenRef.current) {
                gsap.set(sheenRef.current, { xPercent: r * 100 });
            }
        }
    }, [value, ratioFromValue, isDragging]);

    const pressOn = useCallback(() => {
        if (!trackRef.current) return;
        gsap.to(trackRef.current, { 
            scale: 1.05, 
            duration: 0.15, 
            ease: "back.out(1.7)" 
        });
        gsap.to(trackRef.current, { 
            "--ringA": 1, 
            duration: 0.2, 
            ease: "power3.out" 
        });
        gsap.to(trackRef.current, { 
            "--ringB": 1, 
            duration: 0.25, 
            ease: "power3.out" 
        });
        gsap.to(trackRef.current, { 
            "--elev": 1, 
            duration: 0.18, 
            ease: "power3.out" 
        });
        gsap.to(auraRef.current, { 
            opacity: 1, 
            scale: 1.1,
            duration: 0.2, 
            ease: "power3.out" 
        });
    }, []);
    const pressOff = useCallback(() => {
        if (!trackRef.current) return;
        gsap.to(trackRef.current, { 
            scale: 1, 
            duration: 0.2, 
            ease: "back.out(1.7)" 
        });
        gsap.to(trackRef.current, { 
            "--ringA": 0, 
            duration: 0.25, 
            ease: "power3.out" 
        });
        gsap.to(trackRef.current, { 
            "--ringB": 0, 
            duration: 0.3, 
            ease: "power3.out" 
        });
        gsap.to(trackRef.current, { 
            "--elev": 0, 
            duration: 0.25, 
            ease: "power3.out" 
        });
        gsap.to(auraRef.current, { 
            opacity: 0, 
            scale: 1,
            duration: 0.2, 
            ease: "power3.out" 
        });
    }, []);

    const startSheen = useCallback(() => {
        if (!sheenRef.current) return;
        gsap.to(sheenRef.current, {
            keyframes: [
                { xPercent: "-40", opacity: 0, scale: 0.8 },
                { xPercent: "10", opacity: 0.6, scale: 1.1, duration: 0.1, ease: "power2.out" },
                { xPercent: "120", opacity: 0, scale: 0.9, duration: 0.35, ease: "power3.out" }
            ],
            repeat: -1,
            repeatDelay: 0.1
        });
    }, []);
    const stopSheen = useCallback(() => {
        if (!sheenRef.current) return;
        gsap.killTweensOf(sheenRef.current);
        gsap.to(sheenRef.current, { 
            opacity: 0, 
            scale: 1,
            duration: 0.15, 
            ease: "power3.out" 
        });
    }, []);

    const updateFromClientX = useCallback((clientX: number) => {
        if (!trackRef.current || disabled) return;
        const rect = trackRef.current.getBoundingClientRect();
        const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
        const raw = min + ratio * (max - min);
        const next = clamp(snapToStep(raw, min, step, decimals), min, max);
        const r = ratioFromValue(next);
        
        // Kill any existing animations to prevent conflicts
        gsap.killTweensOf([progressRef.current, sheenRef.current]);
        
        // Direct property updates for 60fps - no GSAP during drag
        if (progressRef.current) {
            gsap.set(progressRef.current, { scaleX: r });
        }
        
        if (sheenRef.current) {
            gsap.set(sheenRef.current, { xPercent: r * 100 });
        }
        
        // Dynamic aura effect - more subtle
        const auraIntensity = Math.min(0.6, Math.abs(ratio - r) * 8 + 0.2);
        setAuraVarRef.current?.(auraIntensity);
        
        onChange(next);
    }, [disabled, min, max, step, decimals, ratioFromValue, onChange]);

    const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (disabled) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        setIsDragging(true);
        pressOn();
        startSheen();
        updateFromClientX(e.clientX);
    }, [disabled, pressOn, startSheen, updateFromClientX]);

    const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging || disabled) return;
        updateFromClientX(e.clientX);
    }, [isDragging, disabled, updateFromClientX]);

    const finishDrag = useCallback((target: HTMLDivElement, pointerId: number) => {
        target.releasePointerCapture?.(pointerId);
        setIsDragging(false);
        pressOff();
        stopSheen();
        const r = ratioFromValue(value);
        qToScaleRef.current?.(r);
        qToSheenRef.current?.(r * 100);
        setAuraVarRef.current?.(0);
    }, [pressOff, stopSheen, ratioFromValue, value]);

    const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        finishDrag(e.currentTarget, e.pointerId);
    }, [isDragging, finishDrag]);

    const onPointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        finishDrag(e.currentTarget, e.pointerId);
    }, [isDragging, finishDrag]);

    const onLostCapture = useCallback(() => {
        if (isDragging) setIsDragging(false);
        pressOff();
        stopSheen();
        const r = ratioFromValue(value);
        qToScaleRef.current?.(r);
        qToSheenRef.current?.(r * 100);
        setAuraVarRef.current?.(0);
    }, [isDragging, pressOff, stopSheen, ratioFromValue, value]);

    const onMouseEnter = useCallback(() => {
        if (disabled || isDragging) return;
        gsap.killTweensOf(trackRef.current);
        gsap.to(trackRef.current, { 
            scale: 1.02, 
            duration: 0.15, 
            ease: "power2.out" 
        });
        gsap.to(trackRef.current, { 
            "--ringA": 0.5, 
            duration: 0.15, 
            ease: "power2.out" 
        });
    }, [disabled, isDragging]);

    const onMouseLeave = useCallback(() => {
        if (disabled || isDragging) return;
        gsap.killTweensOf(trackRef.current);
        gsap.to(trackRef.current, { 
            scale: 1, 
            duration: 0.15, 
            ease: "power2.out" 
        });
        gsap.to(trackRef.current, { 
            "--ringA": 0, 
            duration: 0.15, 
            ease: "power2.out" 
        });
    }, [disabled, isDragging]);

    const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        if (disabled) return;
        let next = value;
        const coarse = step * 10;
        switch (e.key) {
            case "ArrowLeft":
            case "ArrowDown":
                e.preventDefault();
                next = clamp(value - step, min, max);
                break;
            case "ArrowRight":
            case "ArrowUp":
                e.preventDefault();
                next = clamp(value + step, min, max);
                break;
            case "PageDown":
                e.preventDefault();
                next = clamp(value - coarse, min, max);
                break;
            case "PageUp":
                e.preventDefault();
                next = clamp(value + coarse, min, max);
                break;
            case "Home":
                e.preventDefault();
                next = min;
                break;
            case "End":
                e.preventDefault();
                next = max;
                break;
            default:
                return;
        }
        next = snapToStep(next, min, step, decimals);
        const r = ratioFromValue(next);
        
        // Kill existing animations first
        gsap.killTweensOf([progressRef.current, sheenRef.current, auraRef.current]);
        
        // Smooth keyboard animations
        gsap.to(progressRef.current, {
            scaleX: r,
            duration: 0.12,
            ease: "power2.out"
        });
        
        gsap.to(sheenRef.current, {
            xPercent: r * 100,
            duration: 0.12,
            ease: "power2.out"
        });
        
        // Brief aura pulse for keyboard interaction
        gsap.fromTo(auraRef.current, 
            { opacity: 0.6, scale: 1.1 },
            { 
                opacity: 0, 
                scale: 1,
                duration: 0.25, 
                ease: "power2.out" 
            }
        );
        
        onChange(next);
    }, [disabled, value, step, min, max, decimals, ratioFromValue, onChange]);

    return (
        <div className={`slider slider--ios ${disabled ? "slider--disabled" : ""} ${className || ""}`} style={style} aria-disabled={disabled || undefined} data-disabled={disabled || undefined}>
            <div
                ref={trackRef}
                className="slider__track"
                role="slider"
                aria-valuemin={min}
                aria-valuemax={max}
                aria-valuenow={value}
                aria-valuetext={`${value}`}
                tabIndex={disabled ? -1 : 0}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
                onLostPointerCapture={onLostCapture}
                onKeyDown={onKeyDown}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
            >
                <div ref={progressRef} className="slider__progress">
                    <div className="slider__gloss" />
                    <div ref={sheenRef} className="slider__sheen" />
                    <div ref={auraRef} className="slider__aura" />
                    <div className="slider__sparkles">
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                    </div>
                    <div className="slider__noise" />
                </div>
            </div>
        </div>
    );
};

export default Slider;
    