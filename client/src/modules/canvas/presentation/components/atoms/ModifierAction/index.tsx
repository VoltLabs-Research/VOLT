import { useEffect, useState, type MouseEvent } from 'react';
import { Play, Square, Check, X, Loader2 } from 'lucide-react';
import type { ExecState } from '../../../hooks/usePluginExecution';
import './ModifierAction.css';

const ICON_SIZE = 12;

const AUTO_DISMISS_MS: Partial<Record<ExecState, number>> = {
    success: 1500,
    error: 2000
};

interface ModifierActionProps {
    execState: ExecState;
    isLegacy: boolean;
    active: boolean;
    forceVisible?: boolean;
    onAction: () => void;
}

const ModifierAction = ({ execState, isLegacy, active, forceVisible, onAction }: ModifierActionProps) => {
    const [displayState, setDisplayState] = useState<ExecState>(execState);

    useEffect(() => {
        setDisplayState(execState);

        const ms = AUTO_DISMISS_MS[execState];
        if (!ms) return;

        const timer = setTimeout(() => setDisplayState('idle'), ms);
        return () => clearTimeout(timer);
    }, [execState]);

    const handleClick = (e: MouseEvent) => {
        e.stopPropagation();
        if (displayState === 'loading') return;
        onAction();
    };

    const alwaysVisible = forceVisible || (isLegacy && active) || displayState !== 'idle';

    const stateClass =
        displayState === 'loading' ? 'modifier-action--loading' :
        displayState === 'success' ? 'modifier-action--success' :
        displayState === 'error' ? 'modifier-action--error' :
        (isLegacy && active) ? 'modifier-action--active' : '';

    const visibilityClass = alwaysVisible ? 'modifier-action--visible' : '';

    const icon =
        displayState === 'loading' ? <Loader2 size={ICON_SIZE} className="modifier-action-spinner" /> :
        displayState === 'success' ? <Check size={ICON_SIZE} /> :
        displayState === 'error' ? <X size={ICON_SIZE} /> :
        (isLegacy && active) ? <Square size={ICON_SIZE - 2} /> :
        <Play size={ICON_SIZE} />;

    return (
        <span
            className={`modifier-action ${stateClass} ${visibilityClass}`}
            onClick={handleClick}
            role="button"
            tabIndex={-1}
        >
            {icon}
        </span>
    );
};

export default ModifierAction;
