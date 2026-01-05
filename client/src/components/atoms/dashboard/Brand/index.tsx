import Container from '@/components/primitives/Container';
import Title from '@/components/primitives/Title';

const Brand = () => {
    return (
        <Container className='sidebar-brand'>
            <div className='sidebar-brand-logo'>V</div>
            <Title className='sidebar-brand-title- color-primary'>Volterra</Title>
        </Container>
    );
};

export default Brand;