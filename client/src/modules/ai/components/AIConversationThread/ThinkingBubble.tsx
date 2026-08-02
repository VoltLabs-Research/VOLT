import { Box, ThinkingDots } from '@voltstack/bravais';

const ThinkingBubble = () => (
    <Box className='ai-message-bubble is-assistant ai-thinking-bubble'>
        <ThinkingDots label='Assistant is thinking' />
    </Box>
);

export default ThinkingBubble;
