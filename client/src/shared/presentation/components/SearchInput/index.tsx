import { forwardRef, InputHTMLAttributes } from 'react';
import { IoSearchOutline } from 'react-icons/io5';
import Container from '@/shared/presentation/components/Container';
import { cn } from '@/shared/utils/cn';
import './SearchInput.css';

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
    containerClassName?: string;
    variant?: 'default' | 'small';
};

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(({
    containerClassName,
    variant = 'default',
    className,
    placeholder = 'Search...',
    ...props
}, ref) => {
    return (
        <Container className={cn('search-input-container d-flex items-center gap-05', variant === 'small' && 'search-input-container--small', containerClassName)}>
            <IoSearchOutline className={cn('search-input-icon color-muted f-shrink-0', variant === 'small' && 'search-input-icon--small')} />
            <input
                ref={ref}
                type='text'
                placeholder={placeholder}
                className={cn('search-input font-size-2 color-primary flex-1', variant === 'small' && 'search-input--small', className)}
                {...props}
            />
        </Container>
    );
});

SearchInput.displayName = 'SearchInput';

export default SearchInput;
