import Container from '@/components/primitives/Container';
import Paragraph from '@/components/primitives/Paragraph';
import Title from '@/components/primitives/Title';

const Brand = () => {
    return (
        <Container className='sidebar-brand gap-075'>
            <div className='sidebar-brand-logo font-size-3'>V</div>
            <Container className='d-flex column gap-02'>
                <Title className='sidebar-brand-title color-primary'>Volt</Title>
                <Paragraph className='font-size-05'>From VoltLabs Research</Paragraph>
            </Container>
        </Container>
    );
};

export default Brand;