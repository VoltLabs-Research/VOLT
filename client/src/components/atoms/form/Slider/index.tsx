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
            qToScaleRef.current?.(r);
            qToSheenRef.current?.(r * 100);
        } else {
            setScaleXRef.current?.(r);
            setSheenXRef.current?.(r * 100);
        }
    }, [value, ratioFromValue, isDragging]);

    const pressOn = useCallback(() => {
        if (!trackRef.current) return;
        gsap.to(trackRef.current, { scale: 1.02, duration: 0.08, ease: "power2.out" });
        gsap.to(trackRef.current, { "--ringA": 1, duration: 0.12, ease: "power2.out" });
        gsap.to(trackRef.current, { "--ringB": 1, duration: 0.18, ease: "power2.out" });
        gsap.to(trackRef.current, { "--elev": 1, duration: 0.14, ease: "power2.out" });
        gsap.to(auraRef.current, { opacity: 1, duration: 0.12, ease: "power2.out" });
    }, []);
    const pressOff = useCallback(() => {
        if (!trackRef.current) return;
        gsap.to(trackRef.current, { scale: 1, duration: 0.12, ease: "power2.out" });
        gsap.to(trackRef.current, { "--ringA": 0, duration: 0.16, ease: "power2.out" });
        gsap.to(trackRef.current, { "--ringB": 0, duration: 0.22, ease: "power2.out" });
        gsap.to(trackRef.current, { "--elev": 0, duration: 0.16, ease: "power2.out" });
        gsap.to(auraRef.current, { opacity: 0, duration: 0.14, ease: "power2.out" });
    }, []);

    const startSheen = useCallback(() => {
        if (!sheenRef.current) return;
        gsap.to(sheenRef.current, {
            keyframes: [
                { xPercent: "-40", opacity: 0 },
                { xPercent: "10", opacity: 0.35, duration: 0.08, ease: "power1.out" },
                { xPercent: "120", opacity: 0, duration: 0.28, ease: "power2.out" }
            ],
            repeat: -1
        });
    }, []);
    const stopSheen = useCallback(() => {
        if (!sheenRef.current) return;
        gsap.killTweensOf(sheenRef.current);
        gsap.to(sheenRef.current, { opacity: 0, duration: 0.08, ease: "power2.out" });
    }, []);

    const updateFromClientX = useCallback((clientX: number) => {
        if (!trackRef.current || disabled) return;
        const rect = trackRef.current.getBoundingClientRect();
        const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
        const raw = min + ratio * (max - min);
        const next = clamp(snapToStep(raw, min, step, decimals), min, max);
        const r = ratioFromValue(next);
        setScaleXRef.current?.(r);
        setSheenXRef.current?.(r * 100);
        setAuraVarRef.current?.(Math.min(1, Math.abs(ratio - r) * 8 + 0.25));
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
        qToScaleRef.current?.(r);
        qToSheenRef.current?.(r * 100);
        setAuraVarRef.current?.(0);
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
    