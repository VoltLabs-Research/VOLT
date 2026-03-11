import { cn } from '@/shared/utils/cn';
import Container from '@/shared/presentation/components/Container';
import './SearchInput.css';
import { forwardRef, InputHTMLAttributes } from 'react';
import type { ReactNode } from 'react';
import { IoSearchOutline } from 'react-icons/io5';

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
    containerClassName?: string;
    variant?: 'default' | 'small';
    overlayContent?: ReactNode;
    overlayVisible?: boolean;
};

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(({
    containerClassName,
    variant = 'default',
    className,
    placeholder = 'Search...',
    overlayContent,
    overlayVisible = false,
    ...props
}, ref) => {
    return (
        <Container className={cn('search-input-container d-flex items-center gap-05', variant === 'small' && 'search-input-container--small', containerClassName)}>
            <IoSearchOutline className={cn('search-input-icon color-muted f-shrink-0', variant === 'small' && 'search-input-icon--small')} />
            <Container className='search-input-content p-relative flex-1'>
                {overlayVisible && overlayContent && (
                    <Container className='search-input-overlay d-flex items-center'>
                        {overlayContent}
                    </Container>
                )}
                <input
                    ref={ref}
                    type='text'
                    placeholder={overlayVisible ? '' : placeholder}
                    className={cn('search-input font-size-2 color-primary flex-1', variant === 'small' && 'search-input--small', className, overlayVisible && 'search-input--with-overlay')}
                    {...props}
                />
            </Container>
        </Container>
    );
});

SearchInput.displayName = 'SearchInput';

export default SearchInput;
