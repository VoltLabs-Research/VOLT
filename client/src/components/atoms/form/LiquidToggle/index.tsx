import React, { useEffect, useRef, useState, useCallback } from 'react';
import './LiquidToggle.css';

const LiquidToggle = ({
    className,
    pressed,
    defaultPressed = false,
    onChange,
    bounce = true,
    deviation = 2,
    alpha = 16
}) => {
    const btnRef = useRef(null);
    const gooBlurRef = useRef(null);
    const gooMatrixRef = useRef(null);

    const isControlled = typeof pressed === 'boolean';
    const [internalPressed, setInternalPressed] = useState(defaultPressed);
    const effectivePressed = isControlled ? pressed : internalPressed;

    const [active, setActive] = useState(false);
    const [complete, setComplete] = useState(effectivePressed ? 100 : 0);

    // Drag state
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState(null);
    const [dragBounds, setDragBounds] = useState(0);
    const pressTimeRef = useRef(0);

    // Update SVG filters
    useEffect(() => {
        if (gooBlurRef.current) {
            gooBlurRef.current.setAttribute('stdDeviation', String(deviation));
        }
        if (gooMatrixRef.current) {
            const values = `
                1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 ${alpha} -10
            `;
            gooMatrixRef.current.setAttribute('values', values);
        }
    }, [deviation, alpha]);

    // Update CSS custom properties
    useEffect(() => {
        document.documentElement.dataset.bounce = String(bounce);
        if (btnRef.current) {
            btnRef.current.style.setProperty('--complete', String(complete));
        }
    }, [bounce, complete]);

    // Sync with controlled prop
    useEffect(() => {
        if (isControlled) {
            const targetComplete = pressed ? 100 : 0;
            setComplete(targetComplete);
            if (btnRef.current) {
                btnRef.current.setAttribute('aria-pressed', String(pressed));
            }
        }
    }, [isControlled, pressed]);

    const toggleTimeline = useCallback(() => {
        if (!btnRef.current) return;
        const el = btnRef.current;
        const wasPressed = el.getAttribute('aria-pressed') === 'true';
        
        setActive(true);
        
        const nextPressed = !wasPressed;
        const toValue = nextPressed ? 100 : 0;
        
        // Simulate GSAP timeline with delays
        setTimeout(() => {
            setComplete(toValue);
            setTimeout(() => {
                setActive(false);
                el.setAttribute('aria-pressed', String(nextPressed));
                if (onChange) onChange(nextPressed);
                if (!isControlled) setInternalPressed(nextPressed);
            }, 50);
        }, bounce ? 200 : 0);
    }, [bounce, isControlled, onChange]);

    // Drag handlers
    const handlePointerDown = useCallback((e) => {
        if (!btnRef.current) return;
        
        pressTimeRef.current = Date.now();
        const rect = btnRef.current.getBoundingClientRect();
        const isOn = btnRef.current.getAttribute('aria-pressed') === 'true';
        
        setDragStart({ x: e.clientX, y: e.clientY });
        setDragBounds(isOn ? (rect.left - e.clientX) : (rect.left + rect.width - e.clientX));
        setActive(true);
        
        btnRef.current.setPointerCapture(e.pointerId);
    }, []);

    const handlePointerMove = useCallback((e) => {
        if (!dragStart) return;
        
        if (!isDragging) {
            const distance = Math.abs(e.clientX - dragStart.x);
            if (distance > 4) {
                setIsDragging(true);
            }
        }
        
        if (isDragging && btnRef.current) {
            const isOn = btnRef.current.getAttribute('aria-pressed') === 'true';
            const dragged = e.clientX - dragStart.x;
            
            let rawComplete;
            if (isOn) {
                rawComplete = ((dragBounds - dragged) / Math.abs(dragBounds)) * 100;
            } else {
                rawComplete = (dragged / Math.abs(dragBounds)) * 100;
            }
            
            const clampedComplete = Math.max(0, Math.min(100, rawComplete));
            setComplete(clampedComplete);
        }
    }, [isDragging, dragStart, dragBounds]);

    const handlePointerUp = useCallback((e) => {
        const releaseTime = Date.now();
        const pressDuration = releaseTime - pressTimeRef.current;
        
        if (isDragging) {
            const targetComplete = complete >= 50 ? 100 : 0;
            setComplete(targetComplete);
            
            setTimeout(() => {
                setActive(false);
                const nextPressed = targetComplete >= 50;
                if (btnRef.current) {
                    btnRef.current.setAttribute('aria-pressed', String(nextPressed));
                }
                if (onChange) onChange(nextPressed);
                if (!isControlled) setInternalPressed(nextPressed);
            }, 150);
        } else if (pressDuration <= 150) {
            toggleTimeline();
        } else {
            setActive(false);
        }
        
        setIsDragging(false);
        setDragStart(null);
        if (btnRef.current) {
            btnRef.current.releasePointerCapture(e.pointerId);
        }
    }, [isDragging, complete, toggleTimeline, onChange, isControlled]);

    const onClick = useCallback((e) => {
        if (isDragging) {
            e.preventDefault();
        }
    }, [isDragging]);

    const onKeyDown = useCallback((e) => {
        if (e.key === ' ') e.preventDefault();
        if (e.key === 'Enter') toggleTimeline();
    }, [toggleTimeline]);

    const onKeyUp = useCallback((e) => {
        if (e.key === ' ') toggleTimeline();
    }, [toggleTimeline]);

    return (
        <div className="liquid-toggle-wrapper">
            <button
                ref={btnRef}
                aria-label="toggle"
                aria-pressed={String(effectivePressed)}
                className={`liquid-toggle${className ? ` ${className}` : ''}`}
                data-active={String(active)}
                type="button"
                onKeyDown={onKeyDown}
                onKeyUp={onKeyUp}
                onClick={onClick}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                style={{ touchAction: 'none' }}
            >
                <div className="knockout">
                    <div className="indicator indicator--masked">
                        <div className="mask"></div>
                    </div>
                </div>

                <div className="indicator__liquid">
                    <div className="shadow"></div>
                    <div className="wrapper">
                        <div className="liquids">
                            <div className="liquid__shadow"></div>
                            <div className="liquid__track"></div>
                        </div>
                    </div>
                    <div className="cover"></div>
                </div>
            </button>
        </div>
    );
};

export default function App() {
    const [isPressed, setIsPressed] = useState(false);

    return (
        <LiquidToggle
            pressed={isPressed}
            onChange={setIsPressed}
            bounce={true}
            deviation={2}
            alpha={16}
        />
    );
}