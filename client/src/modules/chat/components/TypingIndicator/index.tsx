import { ThinkingDots } from '@voltstack/bravais';
import './TypingIndicator.css';
import type { TypingUser } from '@volt/contracts/modules/chat/domain';

interface TypingIndicatorProps {
    users: TypingUser[];
}

const TypingIndicator = ({ users }: TypingIndicatorProps) => {
    const typingUsers = users.filter((u) => u.isTyping);

    if (typingUsers.length === 0) return null;

    const names = typingUsers.map((u) => u.userName).join(', ');
    const message = `${names} ${typingUsers.length === 1 ? 'is' : 'are'} typing…`;

    return (
        <div className='flex gap-2 mb-12' role='status' aria-live='polite' aria-atomic='true'>
            <div className='flex flex-row items-center gap-2 chat-typing-indicator'>
                <ThinkingDots size='sm' label={message} />
                <p className='text-sm text-muted'>
                    {message}
                </p>
            </div>
        </div>
    );
};

export default TypingIndicator;
