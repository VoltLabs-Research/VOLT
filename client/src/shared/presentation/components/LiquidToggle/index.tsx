import { useEffect, useRef, useState, useCallback } from 'react';
import { gsap } from 'gsap';
import '@/shared/presentation/components/LiquidToggle/LiquidToggle.css';

interface LiquidToggleProps {
    className?: string;
    pressed?: boolean;
    defaultPressed?: boolean;
    onChange?: (pressed: boolean) => void;
    bounce?: boolean;
}

const LiquidToggle = ({
    className,
    pressed,
    defaultPressed = false,
    onChange,
    bounce = true
}: LiquidToggleProps) => {
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

    const completeRef = useRef(effectivePressed ? 100 : 0);

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
        if (!btnRef.current) return;
        const el = btnRef.current;
        const wasPressed = el.getAttribute('aria-pressed') === 'true';

        setActive(true);

        const nextPressed = !wasPressed;
        const toValue = nextPressed ? 100 : 0;

        gsap.to({}, {
            duration: 0.15,
            ease: 'power2.out',
            onUpdate: function () {
                const progress = this.progress();
                const currentValue = gsap.utils.interpolate(completeRef.current, toValue, progress);
                setComplete(currentValue);
                completeRef.current = currentValue;
            },
            onComplete: () => {
                setActive(false);
                el.setAttribute('aria-pressed', String(nextPressed));
                onChange?.(nextPressed);
                if (!isControlled) setInternalPressed(nextPressed);
            }
        });
    }, [isControlled, onChange]);

    const handlePointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        if (!btnRef.current) return;

        pressTimeRef.current = Date.now();
        const rect = btnRef.current.getBoundingClientRect();
        const isOn = btnRef.current.getAttribute('aria-pressed') === 'true';

        setDragStart({ x: e.clientX, y: e.clientY });
        setDragBounds(isOn ? (rect.left - e.clientX) : (rect.left + rect.width - e.clientX));
        setActive(true);

        btnRef.current.setPointerCapture(e.pointerId);
    }, []);

    const handlePointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
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

            gsap.to({}, {
                duration: 0.1,
                ease: 'power2.out',
                onUpdate: function () {
                    const progress = this.progress();
                    const currentValue = gsap.utils.interpolate(completeRef.current, clampedComplete, progress);
                    setComplete(currentValue);
                }
            });
        }
    }, [isDragging, dragStart, dragBounds]);

    const handlePointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        const releaseTime = Date.now();
        const pressDuration = releaseTime - pressTimeRef.current;

        if (isDragging) {
            const targetComplete = complete >= 50 ? 100 : 0;

            gsap.to({}, {
                duration: 0.2,
                ease: 'power3.out',
                onUpdate: function () {
                    const progress = this.progress();
                    const currentValue = gsap.utils.interpolate(complete, targetComplete, progress);
                    setComplete(currentValue);
                    completeRef.current = currentValue;
                },
                onComplete: () => {
                    setActive(false);
                    const nextPressed = targetComplete >= 50;
                    if (btnRef.current) {
                        btnRef.current.setAttribute('aria-pressed', String(nextPressed));
                    }
                    onChange?.(nextPressed);
                    if (!isControlled) setInternalPressed(nextPressed);
                }
            });
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

    const onClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        if (isDragging) e.preventDefault();
    }, [isDragging]);

    const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === ' ') e.preventDefault();
        if (e.key === 'Enter') toggleTimeline();
    }, [toggleTimeline]);

    const onKeyUp = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === ' ') toggleTimeline();
    }, [toggleTimeline]);

    return (
        <div className='liquid-toggle-wrapper'>
            <button
                ref={btnRef}
                aria-label='toggle'
                aria-pressed={String(effectivePressed)}
                className={`liquid-toggle${className ? ` ${className}` : ''}`}
                data-active={String(active)}
                type='button'
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
};

export default LiquidToggle;
