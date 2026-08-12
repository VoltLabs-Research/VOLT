import { formatBucketTitle } from '@/modules/dashboard/utils/metric-buckets';
import type { DashboardRangeOption } from '@/modules/dashboard/contracts/range';
import type { TeamActivityPoint } from '@/modules/dashboard/hooks/use-team-activity-series';

interface ActivityTableViewProps {
    points: TeamActivityPoint[];
    range: DashboardRangeOption;
}

/*
 * The chart's WCAG-clean twin. Per-bucket values are otherwise only reachable by
 * hovering, which excludes keyboard and screen-reader users; a native
 * details/table keeps every number readable without one.
 */
const ActivityTableView = ({ points, range }: ActivityTableViewProps) => (
    <details className='mt-2 border-t border-border pt-3'>
        <summary className='cursor-pointer text-xs text-muted transition-colors duration-200 ease-[ease] hover:text-foreground'>
            View as table
        </summary>

        <div className='mt-3 max-h-64 overflow-auto'>
            <table className='w-full border-collapse text-left'>
                <caption className='sr-only'>
                    {`Team activity per ${range.bucket}, ${range.label}`}
                </caption>
                <thead>
                    <tr className='text-2xs uppercase tracking-[0.05em] text-muted'>
                        <th scope='col' className='sticky top-0 bg-surface py-1 pr-4 font-medium'>
                            {range.bucket === 'week' ? 'Week' : 'Day'}
                        </th>
                        <th scope='col' className='sticky top-0 bg-surface py-1 pr-4 text-right font-medium'>
                            Trajectories
                        </th>
                        <th scope='col' className='sticky top-0 bg-surface py-1 pr-4 text-right font-medium'>
                            Analyses
                        </th>
                        <th scope='col' className='sticky top-0 bg-surface py-1 text-right font-medium'>
                            Actions
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {points.map((point) => (
                        <tr key={point.label} className='border-t border-border'>
                            <th scope='row' className='py-1 pr-4 text-xs font-normal text-muted'>
                                {formatBucketTitle(point.label, range.bucket)}
                            </th>
                            <td className='tabular-nums lining-nums py-1 pr-4 text-right text-xs text-foreground'>
                                {point.trajectories}
                            </td>
                            <td className='tabular-nums lining-nums py-1 pr-4 text-right text-xs text-foreground'>
                                {point.analyses}
                            </td>
                            <td className='tabular-nums lining-nums py-1 text-right text-xs text-foreground'>
                                {point.actions}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </details>
);

export default ActivityTableView;
