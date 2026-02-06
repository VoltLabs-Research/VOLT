import type { TypingUser } from '@/modules/chat/domain/entities';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import './TypingIndicator.css';

interface TypingIndicatorProps {
    users: TypingUser[];
};

const TypingIndicator = ({ users }: TypingIndicatorProps) => {
    const typingUsers = users.filter((u) => u.isTyping);
    
    if (typingUsers.length === 0) return null;

    const names = typingUsers.map((u) => u.userName).join(', ');

    return (
        <Container className='d-flex gap-05 mb-3'>
            <Container className='d-flex items-center gap-05 chat-typing-indicator'>
                <Container className='d-flex gap-025'>
                    <Container className='chat-typing-dot' />
                    <Container className='chat-typing-dot' />
                    <Container className='chat-typing-dot' />
                </Container>
                <Paragraph className='font-size-1 color-muted'>
                    {names} typing...
                </Paragraph>
            </Container>
        </Container>
    );
};

export default TypingIndicator;
