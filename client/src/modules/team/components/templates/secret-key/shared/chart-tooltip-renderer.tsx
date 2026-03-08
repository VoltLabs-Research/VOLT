import ChartTooltip from '@/shared/presentation/components/ChartTooltip';
import type { TooltipContentProps } from 'recharts';

interface TooltipPayloadRecord {
    [key: string]: string | number;
};

const isTooltipPayloadRecord = (value: unknown): value is TooltipPayloadRecord => {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    return Object.values(value).every((entry) => typeof entry === 'string' || typeof entry === 'number');
};

export const createTooltipRenderer = (
    titleKey: string,
    label: string,
    color?: string
) => {
    return ({ active, payload }: TooltipContentProps<string | number, string>) => {
        if (!active || !payload?.length) return null;

        const firstPayload = payload[0]?.payload;
        const firstValue = payload[0]?.value;
        if (!isTooltipPayloadRecord(firstPayload) || (typeof firstValue !== 'string' && typeof firstValue !== 'number')) {
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
