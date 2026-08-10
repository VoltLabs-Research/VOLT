import { Skeleton } from '@heroui/react';
import {
    SECRET_KEY_PAGE_CARDS_CLASS,
    SECRET_KEY_PAGE_CARD_CLASS,
    SECRET_KEY_PAGE_CHARTS_CLASS,
    SECRET_KEY_PAGE_CLASS,
    SECRET_KEY_PAGE_MAIN_CLASS
} from '@/modules/team/components/secret-key/shared/secret-key-page-styles';

const CHART_SKELETON_KEYS = ['hourly', 'endpoints', 'status-codes', 'recent'];
const CARD_SKELETON_KEYS = ['requests', 'response-time', 'success-rate', 'last-used'];

const UsageSkeleton = () => (
    <div className={SECRET_KEY_PAGE_CLASS}>
        <div className={SECRET_KEY_PAGE_MAIN_CLASS}>
            <div className='flex flex-row items-center gap-4'>
                <Skeleton className='size-6 rounded-full' />
                <Skeleton className='h-8 w-[300px] rounded-md' />
            </div>
            <div className={SECRET_KEY_PAGE_CARDS_CLASS}>
                {CARD_SKELETON_KEYS.map((key) => (
                    <div className={SECRET_KEY_PAGE_CARD_CLASS} key={key}>
                        <Skeleton className='h-4 w-[100px] rounded-md' />
                        <Skeleton className='mt-2 h-10 w-20 rounded-sm' />
                    </div>
                ))}
            </div>
            <div className={SECRET_KEY_PAGE_CHARTS_CLASS}>
                {CHART_SKELETON_KEYS.map((key) => (
                    <Skeleton key={key} className='h-[300px] w-full rounded-lg' />
                ))}
            </div>
        </div>
    </div>
);

export default UsageSkeleton;
