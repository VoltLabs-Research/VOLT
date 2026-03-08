import Container from '@/shared/presentation/components/Container';
import './Loader.css';

interface LoaderProps {
    scale: number;
    isFixed?: boolean;
    className?: string;
};

const Loader = ({ scale, isFixed = true, className = '' }: LoaderProps) => {
    const loaderItems = Array.from({ length: 12 }, (_, index) => index + 1);

    return (
        <Container className={`d-flex flex-center ${isFixed ? 'p-fixed inset-0' : ''} ${className}`}>
            <Container className='p-relative' style={{ transform: 'scale(' + scale + ')' }}>
                {loaderItems.map((item) => (
                    <Container
                        key={item}
                        className={`p-absolute Loader-Item Loader-Item-${item}`} />
                ))}
            </Container>
        </Container>
    );
};

export default Loader;
