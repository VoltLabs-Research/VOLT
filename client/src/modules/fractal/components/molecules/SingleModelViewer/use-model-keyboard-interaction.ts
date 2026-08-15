import { useEffect } from 'react';

interface UseModelKeyboardInteractionParams {
    enabled: boolean;
    onRotateXNegative: () => void;
    onRotateXPositive: () => void;
    onRotateYNegative: () => void;
    onRotateYPositive: () => void;
    onRotateZNegative: () => void;
    onRotateZPositive: () => void;
    onDeselect: () => void;
}

export default function useModelKeyboardInteraction({
    enabled,
    onRotateXNegative,
    onRotateXPositive,
    onRotateYNegative,
    onRotateYPositive,
    onRotateZNegative,
    onRotateZPositive,
    onDeselect
}: UseModelKeyboardInteractionParams) {
    useEffect(() => {
        if (!enabled) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            const isCtrlModifierPressed = event.ctrlKey || event.metaKey;

            if (event.shiftKey && !(event.ctrlKey || event.metaKey)) {
                if (event.code === 'ArrowLeft') {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    onRotateZNegative();
                    return;
                }

                if (event.code === 'ArrowRight') {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    onRotateZPositive();
                    return;
                }
            }

            if (!isCtrlModifierPressed) {
                if (event.key === 'Escape') {
                    onDeselect();
                }

                return;
            }

            if (event.code === 'ArrowUp') {
                event.preventDefault();
                event.stopImmediatePropagation();
                onRotateXNegative();
                return;
            }

            if (event.code === 'ArrowDown') {
                event.preventDefault();
                event.stopImmediatePropagation();
                onRotateXPositive();
                return;
            }

            if (event.code === 'ArrowLeft') {
                event.preventDefault();
                event.stopImmediatePropagation();
                onRotateYNegative();
                return;
            }

            if (event.code === 'ArrowRight') {
                event.preventDefault();
                event.stopImmediatePropagation();
                onRotateYPositive();
                return;
            }

            if (event.key === 'Escape') {
                onDeselect();
            }
        };

        window.addEventListener('keydown', handleKeyDown, { capture: true });

        return () => {
            window.removeEventListener('keydown', handleKeyDown, { capture: true });
        };
    }, [
        enabled,
        onDeselect,
        onRotateXNegative,
        onRotateXPositive,
        onRotateYNegative,
        onRotateYPositive,
        onRotateZNegative,
        onRotateZPositive
    ]);
}
