import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import './Brand.css';

const Brand = () => {
    return (
        <Container className='sidebar-brand gap-075'>
            <Container className='sidebar-brand-logo font-size-3'>V</Container>
            <Container className='d-flex column gap-02'>
                <Title className='sidebar-brand-title color-primary'>Volt</Title>
                <Paragraph className='font-size-05'>From VoltLabs Research</Paragraph>
            </Container>
        </Container>
    );
};

export default Brand;
