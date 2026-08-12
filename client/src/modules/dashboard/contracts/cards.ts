export type DashboardCardDeltaDirection = 'up' | 'down' | 'flat';

export interface DashboardCardDelta{
    direction: DashboardCardDeltaDirection;
    /**
     * Unsigned magnitude, already chosen by the hook: "12%" when the comparison
     * period is big enough for a ratio to mean something, otherwise the spelled
     * out absolute movement ("3 fewer"). Empty when nothing moved.
     */
    magnitude: string;
}

export interface DashboardCard{
    key: string;
    name: string;
    listingUrl?: string;
    /** Abbreviated for display ("1.2k"). */
    count: string;
    rawCount: number;
    /** Month-over-month, independent of the selected chart window. */
    delta: DashboardCardDelta;
    /** Rows created inside the selected window, for the context line. */
    windowTotal: number;
}
