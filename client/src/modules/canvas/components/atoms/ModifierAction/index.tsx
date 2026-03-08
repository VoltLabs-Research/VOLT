import { Play, Square, Check, X, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ExecState } from '../../../hooks/use-plugin-execution';
import type { MouseEvent } from 'react';

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
};

const ModifierAction = ({ execState, isLegacy, active, forceVisible, onAction }: ModifierActionProps) => {
    const [displayState, setDisplayState] = useState<ExecState>(execState);

    useEffect(() => {
        setDisplayState(execState);

        const ms = AUTO_DISMISS_MS[execState];
        if (!ms) return;

        const timer = setTimeout(() => setDisplayState(ExecState.Idle), ms);
        return () => clearTimeout(timer);
    }, [execState]);

    const handleClick = (e: MouseEvent) => {
        e.stopPropagation();
        if (displayState === ExecState.Loading) return;
        onAction();
    };

    const alwaysVisible = forceVisible || (isLegacy && active) || displayState !== ExecState.Idle;

    let stateClass = '';
    if (displayState === ExecState.Loading) {
        stateClass = 'modifier-action--loading';
    } else if (displayState === ExecState.Success) {
        stateClass = 'modifier-action--success';
    } else if (displayState === ExecState.Error) {
        stateClass = 'modifier-action--error';
    } else if (isLegacy && active) {
        stateClass = 'modifier-action--active';
    }

    const visibilityClass = alwaysVisible ? 'modifier-action--visible' : '';

    let icon = <Play size={ICON_SIZE} />;
    if (displayState === ExecState.Loading) {
        icon = <Loader2 size={ICON_SIZE} className="modifier-action-spinner" />;
    } else if (displayState === ExecState.Success) {
        icon = <Check size={ICON_SIZE} />;
    } else if (displayState === ExecState.Error) {
        icon = <X size={ICON_SIZE} />;
    } else if (isLegacy && active) {
        icon = <Square size={ICON_SIZE - 2} />;
    }

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
