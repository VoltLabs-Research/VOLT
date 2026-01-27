import Title from '@/shared/presentation/components/primitives/Title';
import '@/modules/chat/presentation/components/atoms/WelcomeEmpty/WelcomeEmpty.css';
import Container from '@/shared/presentation/components/primitives/Container';
import Paragraph from '@/shared/presentation/components/primitives/Paragraph';

type WelcomeEmptyProps = {
    isConnected: boolean
};

const WelcomeEmpty = ({ isConnected }: WelcomeEmptyProps) => {
    return (
        <Container className='d-flex flex-1 flex-center chat-welcome-container'>
            <Container className='text-center p-2 chat-welcome-content d-flex gap-05 column'>
                <Title className="font-size-5 font-weight-6 color-primary">Welcome to Chat</Title>
                <Paragraph className='font-size-3 color-secondary'>Select a conversation or start a new chat with a team member</Paragraph>
                {!isConnected && (
                    <Container className='chat-connection-status mt-1'>
                        <Paragraph className='font-size-2-5 color-muted'>Connecting to chat service...</Paragraph>
                    </Container>
                )}
            </Container>
        </Container>
    );
};

export default WelcomeEmpty;
