const ThinkingBubble = () => (
    <div className='min-w-0 max-w-full overflow-hidden rounded-2xl px-[0.95rem] py-3 leading-[1.55] whitespace-normal border-none bg-transparent pl-0 text-foreground min-h-[1.8rem]'>
        <span className='inline-flex items-center gap-1' role='status' aria-live='polite'>
            <span className='sr-only'>Assistant is thinking</span>
            <span className='size-1.5 rounded-full bg-muted animate-pulse animation-duration-[1200ms] [animation-delay:0.15s]' aria-hidden='true' />
            <span className='size-1.5 rounded-full bg-muted animate-pulse animation-duration-[1200ms] [animation-delay:0.3s]' aria-hidden='true' />
            <span className='size-1.5 rounded-full bg-muted animate-pulse animation-duration-[1200ms] [animation-delay:0.45s]' aria-hidden='true' />
        </span>
    </div>
);

export default ThinkingBubble;
