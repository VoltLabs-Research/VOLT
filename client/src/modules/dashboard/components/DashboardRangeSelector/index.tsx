import { Button } from '@heroui/react';
import { DASHBOARD_RANGE_OPTIONS } from '@/modules/dashboard/contracts/range';
import type { DashboardRangeKey } from '@/modules/dashboard/contracts/range';

interface DashboardRangeSelectorProps {
    value: DashboardRangeKey;
    onChange: (value: DashboardRangeKey) => void;
}

/*
 * A group of pressed-state buttons rather than a tablist: these are filters, and
 * there are no tabpanels for a tablist to own. aria-pressed carries the
 * selection for screen readers, so it never rests on the fill alone.
 */
const DashboardRangeSelector = ({ value, onChange }: DashboardRangeSelectorProps) => (
    <div
        role='group'
        aria-label='Time range'
        className='flex shrink-0 flex-row items-center gap-1 rounded-md border border-border p-0.5'
    >
        {DASHBOARD_RANGE_OPTIONS.map((option) => {
            const isSelected = option.key === value;

            return (
                <Button
                    key={option.key}
                    size='sm'
                    variant={isSelected ? 'secondary' : 'ghost'}
                    aria-pressed={isSelected}
                    aria-label={option.label}
                    onPress={() => onChange(option.key)}
                >
                    {option.shortLabel}
                </Button>
            );
        })}
    </div>
);

export default DashboardRangeSelector;
