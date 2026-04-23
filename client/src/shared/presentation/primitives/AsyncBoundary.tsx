import type { ReactNode } from 'react';

export interface AsyncBoundaryState {
    loading?: boolean;
    error?: unknown;
    accessDenied?: boolean;
    /** When empty is true, the `empty` slot renders instead of children. */
    empty?: boolean;
}

export interface AsyncBoundaryProps {
    state: AsyncBoundaryState;
    loading: ReactNode;
    error: (err: unknown) => ReactNode;
    accessDenied?: ReactNode;
    empty?: ReactNode;
    children: ReactNode;
}

/**
 * Renders the appropriate fallback based on async state. Consolidates the
 * loading → error → access-denied → empty → content switch hand-rolled in
 * every data-backed panel.
 *
 * The `error` slot is a function so callers can decide how to derive
 * retry/description from the error value.
 */
const AsyncBoundary = ({
    state,
    loading,
    error,
    accessDenied,
    empty,
    children
}: AsyncBoundaryProps) => {
    if (state.accessDenied && accessDenied) return <>{accessDenied}</>;
    if (state.error !== undefined && state.error !== null) return <>{error(state.error)}</>;
    if (state.loading) return <>{loading}</>;
    if (state.empty && empty !== undefined) return <>{empty}</>;
    return <>{children}</>;
};

export default AsyncBoundary;
