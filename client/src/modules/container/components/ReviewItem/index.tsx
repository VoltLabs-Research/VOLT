import type { ReactNode } from 'react';

interface ReviewItemProps {
    label: string;
    value: ReactNode;
    valueClassName?: string;
};

const ReviewItem = ({ label, value, valueClassName = '' }: ReviewItemProps) => (
    <div className='volt-container create-container-review-item'>
        <span className='create-container-label color-secondary font-size-2'>{label}</span>
        <span className={`create-container-value font-weight-5 ${valueClassName}`}>{value}</span>
    </div>
);

export default ReviewItem;
