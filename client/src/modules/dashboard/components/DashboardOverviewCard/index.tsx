import DashboardCard from '@/modules/dashboard/components/DashboardCard';
import DashboardStat from '@/modules/dashboard/components/DashboardStat';
import { ArrowRight } from 'lucide-react';
import type { DashboardCard as DashboardMetricsCard } from '@/modules/dashboard/contracts/cards';
import type { DashboardRangeOption } from '@/modules/dashboard/contracts/range';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface DashboardOverviewCardProps {
    card: DashboardMetricsCard;
    icon: ReactNode;
    range: DashboardRangeOption;
}

const DashboardOverviewCard = ({ card, icon, range }: DashboardOverviewCardProps) => {
    const navigate = useNavigate();
    const isClickable = Boolean(card.listingUrl);
    const context = `${card.windowTotal} in the ${range.label}`;

    const handleClick = () => {
        if (card.listingUrl) {
            navigate(card.listingUrl);
        }
    };

    const content = (
        <DashboardStat
            icon={icon}
            name={card.name}
            value={card.count}
            delta={card.delta}
            deltaLabel='vs last month'
            context={context}
        />
    );

    return (
        <DashboardCard
            className='group/card col-span-4 min-h-[130px] p-0 transition-[border-color] duration-200 ease-[ease] max-[1200px]:col-span-6 max-[768px]:col-span-12'
            isRelative={true}
            overflowHidden={true}
        >
            {isClickable ? (
                <button
                    type='button'
                    className='group/statbtn relative h-full w-full cursor-pointer border-none bg-transparent p-0 text-left focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--border),inset_0_0_0_3px_var(--focus)]'
                    onClick={handleClick}
                    aria-label={`Open ${card.name}`}
                >
                    {content}

                    <div className='absolute top-4 right-4 text-lg text-foreground opacity-0 transition-opacity duration-200 ease-[ease] group-hover/card:opacity-100 group-focus-visible/statbtn:opacity-100'>
                        <ArrowRight />
                    </div>
                </button>
            ) : content}
        </DashboardCard>
    );
};

export default DashboardOverviewCard;
