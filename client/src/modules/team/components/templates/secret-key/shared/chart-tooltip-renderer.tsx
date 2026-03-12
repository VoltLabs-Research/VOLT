import ChartTooltip from '@/shared/presentation/components/ChartTooltip';
import type { ContentType } from 'recharts/types/component/Tooltip';
import type { TooltipContentProps } from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';

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
): ContentType<ValueType, NameType> => {
    return ({ active, payload }: TooltipContentProps<ValueType, NameType>) => {
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
