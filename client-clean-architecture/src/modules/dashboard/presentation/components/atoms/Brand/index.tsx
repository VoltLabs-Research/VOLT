import Container from '@/shared/presentation/components/primitives/Container';
import Title from '@/shared/presentation/components/primitives/Title';

const Brand = () => {
    return (
        <Container className='sidebar-brand gap-075'>
            <div className='sidebar-brand-logo font-size-3'>V</div>
            <Title className='sidebar-brand-title- color-primary'>Volterra</Title>
        </Container>
    );
};

export default Brand;
