import Container from '@/components/primitives/Container';
import Paragraph from '@/components/primitives/Paragraph';
import '@/features/chat/components/atoms/TypingIndicator/TypingIndicator.css';

type TypingIndicator = {
    users: { userName: string }[]
};

const TypingIndicator = ({ users }: TypingIndicator) => {
    if(!users.length) return null;

      return(
        <Container className='d-flex gap-05 p-relative mb-3 chat-message received'>
            <Container className='d-flex items-center gap-05 chat-typing-indicator'>
                <Container className='d-flex gap-025'>
                    <Container className='chat-typing-dot' />
                    <Container className='chat-typing-dot' />
                    <Container className='chat-typing-dot' />
                </Container>
                <Paragraph className='font-size-1 color-muted'>
                    {users.map(u => u.userName).join(', ')} typing...
                </Paragraph>
            </Container>
        </Container>
    );
};

export default TypingIndicator;
