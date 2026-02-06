import { forwardRef, InputHTMLAttributes } from 'react';
import { IoSearchOutline } from 'react-icons/io5';
import Container from '@/shared/presentation/components/Container';
import { cn } from '@/shared/utils/cn';
import './SearchInput.css';

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
    containerClassName?: string;
};

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(({
    containerClassName,
    className,
    placeholder = 'Search...',
    ...props
}, ref) => {
    return (
        <Container className={cn('search-input-container d-flex items-center gap-05', containerClassName)}>
            <IoSearchOutline className='search-input-icon color-muted f-shrink-0' />
            <input
                ref={ref}
                type='text'
                placeholder={placeholder}
                className={cn('search-input font-size-2 color-primary flex-1', className)}
                {...props}
            />
        </Container>
    );
});

SearchInput.displayName = 'SearchInput';

export default SearchInput;
