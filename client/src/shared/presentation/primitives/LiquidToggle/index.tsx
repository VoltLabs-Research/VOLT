import '../LiquidToggle/LiquidToggle.css';
import { usePrefersReducedMotion } from '@/shared/presentation/hooks/use-prefers-reduced-motion';
import { forwardRef, useEffect, useRef, useState, useCallback } from 'react';

interface LiquidToggleProps {
    className?: string;
    id?: string;
    pressed?: boolean;
    defaultPressed?: boolean;
    onChange?: (pressed: boolean) => void;
    bounce?: boolean;
    disabled?: boolean;
    'aria-label'?: string;
    'aria-labelledby'?: string;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
    'aria-errormessage'?: string;
};

const LiquidToggle = forwardRef<HTMLDivElement, LiquidToggleProps>(({
    className,
    id,
    pressed,
    defaultPressed = false,
    onChange,
    bounce = true,
    disabled = false,
    'aria-label': ariaLabel = 'toggle',
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    'aria-errormessage': ariaErrorMessage
}, ref) => {
    const btnRef = useRef<HTMLButtonElement | null>(null);

    const isControlled = typeof pressed === 'boolean';
    const [internalPressed, setInternalPressed] = useState(defaultPressed);
    const effectivePressed = isControlled ? pressed : internalPressed;

    const [active, setActive] = useState(false);
    const [complete, setComplete] = useState(effectivePressed ? 100 : 0);

    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
    const [dragBounds, setDragBounds] = useState(0);
    const pressTimeRef = useRef(0);
    const prefersReducedMotion = usePrefersReducedMotion();

    const completeRef = useRef(effectivePressed ? 100 : 0);

    const commitPressedState = useCallback((nextPressed: boolean) => {
        const targetComplete = nextPressed ? 100 : 0;

        setActive(false);
        setComplete(targetComplete);
        completeRef.current = targetComplete;

        if (btnRef.current) {
            btnRef.current.setAttribute('aria-pressed', String(nextPressed));
        }

        onChange?.(nextPressed);

        if (!isControlled) {
            setInternalPressed(nextPressed);
        }
    }, [isControlled, onChange]);

    useEffect(() => {
        document.documentElement.dataset.bounce = String(bounce);
    }, [bounce]);

    useEffect(() => {
        if (btnRef.current) {
            btnRef.current.style.setProperty('--complete', String(complete));
            completeRef.current = complete;
        }
    }, [complete]);

    useEffect(() => {
        if (!isControlled) return;
        const targetComplete = pressed ? 100 : 0;
        setComplete(targetComplete);
        if (btnRef.current) {
            btnRef.current.setAttribute('aria-pressed', String(pressed));
        }
    }, [isControlled, pressed]);

    const toggleTimeline = useCallback(() => {
        if (!btnRef.current || disabled) return;
        const el = btnRef.current;
        const wasPressed = el.getAttribute('aria-pressed') === 'true';
        const nextPressed = !wasPressed;

        setActive(true);

        // CSS transitions on --complete (and dependent props) handle the visual tween.
        // We commit the final state immediately; the browser animates via transition-duration.
        commitPressedState(nextPressed);
    }, [commitPressedState, disabled]);

    const handlePointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        if (!btnRef.current || disabled) return;

        pressTimeRef.current = Date.now();
        const rect = btnRef.current.getBoundingClientRect();
        const isOn = btnRef.current.getAttribute('aria-pressed') === 'true';

        setDragStart({ x: e.clientX, y: e.clientY });
        setDragBounds(isOn ? (rect.left - e.clientX) : (rect.left + rect.width - e.clientX));
        setActive(true);

        btnRef.current.setPointerCapture(e.pointerId);
    }, [disabled]);

    const handlePointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        if (disabled) return;
        if (!dragStart) return;

        if (!isDragging) {
            const distance = Math.abs(e.clientX - dragStart.x);
            if (distance > 4) setIsDragging(true);
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
            completeRef.current = clampedComplete;
        }
    }, [disabled, isDragging, dragStart, dragBounds]);

    const handlePointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        if (disabled) return;
        const releaseTime = Date.now();
        const pressDuration = releaseTime - pressTimeRef.current;

        if (isDragging) {
            const targetComplete = complete >= 50 ? 100 : 0;
            commitPressedState(targetComplete >= 50);
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
    }, [commitPressedState, disabled, isDragging, complete, toggleTimeline]);

    const onClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        if (isDragging) e.preventDefault();
    }, [isDragging]);

    const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (disabled) return;
        if (e.key === ' ') e.preventDefault();
        if (e.key === 'Enter') toggleTimeline();
    }, [disabled, toggleTimeline]);

    const onKeyUp = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (disabled) return;
        if (e.key === ' ') toggleTimeline();
    }, [disabled, toggleTimeline]);

    // prefersReducedMotion is respected by the CSS @media (prefers-reduced-motion)
    // block which disables transitions. Kept in deps to preserve intent for future use.
    void prefersReducedMotion;

    return (
        <div ref={ref} className='liquid-toggle-wrapper'>
            <button
                ref={btnRef}
                id={id}
                aria-label={ariaLabel}
                aria-labelledby={ariaLabelledBy}
                aria-describedby={ariaDescribedBy}
                aria-invalid={ariaInvalid}
                aria-errormessage={ariaErrorMessage}
                aria-pressed={effectivePressed}
                className={`liquid-toggle${className ? ` ${className}` : ''}`}
                data-active={String(active)}
                type='button'
                disabled={disabled}
                onKeyDown={onKeyDown}
                onKeyUp={onKeyUp}
                onClick={onClick}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                style={{ touchAction: 'none' }}
            >
                <div className='knockout'>
                    <div className='indicator indicator--masked'>
                        <div className='mask'></div>
                    </div>
                </div>

                <div className='indicator__liquid'>
                    <div className='shadow'></div>
                    <div className='wrapper'>
                        <div className='liquids'>
                            <div className='liquid__shadow'></div>
                            <div className='liquid__track'></div>
                        </div>
                    </div>
                    <div className='cover'></div>
                </div>
            </button>
        </div>
    );
});

LiquidToggle.displayName = 'LiquidToggle';

export default LiquidToggle;
