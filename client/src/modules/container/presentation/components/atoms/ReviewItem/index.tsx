import Container from '@/shared/presentation/components/Container';

interface ReviewItemProps {
    label: string;
    value: React.ReactNode;
    valueClassName?: string;
};

const ReviewItem = ({ label, value, valueClassName = '' }: ReviewItemProps) => (
    <Container className='d-flex content-between create-container-review-item'>
        <span className='create-container-label color-muted'>{label}</span>
        <span className={`create-container-value font-weight-5 ${valueClassName}`}>{value}</span>
    </Container>
);

export default ReviewItem;
