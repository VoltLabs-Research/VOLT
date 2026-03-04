import ChartTooltip from '@/shared/presentation/components/ChartTooltip';

export const CHART_COLORS = {
    requests: 'var(--accent-blue)',
    endpoints: 'var(--accent-green)'
} as const;

interface TooltipPayload {
    active?: boolean;
    payload?: Array<{ value: string | number; payload: Record<string, string | number> }>;
}

export const createTooltipRenderer = (
    titleKey: string,
    label: string,
    color?: string
) => {
    return ({ active, payload }: TooltipPayload) => {
        if (!active || !payload?.length) return null;
        return (
            <ChartTooltip
                title={String(payload[0].payload[titleKey])}
                items={[{ label, value: payload[0].value, ...(color ? { color } : {}) }]}
            />
        );
    };
};
