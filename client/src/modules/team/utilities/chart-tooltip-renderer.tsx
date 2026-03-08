import ChartTooltip from '@/shared/presentation/components/ChartTooltip';
import type { TooltipContentProps } from 'recharts';

export const createTooltipRenderer = (
    titleKey: string,
    label: string,
    color?: string
) => {
    return ({ active, payload }: TooltipContentProps<string | number, string>) => {
        if (!active || !payload?.length) return null;

        const firstPayload = payload[0]?.payload as Record<string, string | number> | undefined;
        const firstValue = payload[0]?.value;
        if (!firstPayload || (typeof firstValue !== 'string' && typeof firstValue !== 'number')) {
            return null;
        }

        return (
            <ChartTooltip
                title={String(firstPayload[titleKey])}
                items={[{ label, value: firstValue, ...(color ? { color } : {}) }]}
            />
        );
    };
};
