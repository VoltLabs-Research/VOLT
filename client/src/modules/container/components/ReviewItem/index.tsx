import type { ReactNode } from 'react';
import { KeyValueRow } from '@/shared/presentation/primitives';

interface ReviewItemProps {
    label: string;
    value: ReactNode;
    valueClassName?: string;
};

const ReviewItem = ({ label, value, valueClassName }: ReviewItemProps) => (
    <KeyValueRow label={label} value={value} className={valueClassName} />
);

export default ReviewItem;
