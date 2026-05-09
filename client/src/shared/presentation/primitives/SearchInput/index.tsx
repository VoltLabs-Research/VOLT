import { cn } from '@/shared/utils/cn';
import './SearchInput.css';
import { Search } from 'lucide-react';
import { forwardRef, useRef } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

const MISSING_SEARCH_INPUT_NAME_ERROR = 'SearchInput requires an accessible name via aria-label, aria-labelledby, or an external label bound to its id.';
const FALLBACK_SEARCH_LABEL = 'Search';

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
    placeholder = 'Search…',
    overlayContent,
    overlayVisible = false,
    id,
    title,
    autoComplete = 'off',
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    ...props
}, ref) => {
    const hasWarnedForMissingNameRef = useRef(false);
    const resolvedAriaLabel = ariaLabel?.trim() || undefined;
    const resolvedAriaLabelledBy = ariaLabelledBy?.trim() || undefined;
    const resolvedTitle = title?.trim() || undefined;
    const hasExternalLabelContract = Boolean(id);

    let accessibleName = resolvedAriaLabel ?? resolvedTitle;
    if (!resolvedAriaLabelledBy && !accessibleName && !hasExternalLabelContract) {
        if (!hasWarnedForMissingNameRef.current) {
            console.warn(MISSING_SEARCH_INPUT_NAME_ERROR);
            hasWarnedForMissingNameRef.current = true;
        }

        accessibleName = FALLBACK_SEARCH_LABEL;
    }

    return (
        <div className={`${cn('search-input-container d-flex items-center gap-05', variant === 'small' && 'search-input-container--small', containerClassName)}`}>
            <Search aria-hidden='true' className={cn('search-input-icon color-muted f-shrink-0', variant === 'small' && 'search-input-icon--small')} />
            <div className='search-input-content p-relative flex-1'>
                {overlayVisible && overlayContent && (
                    <div className='search-input-overlay d-flex items-center'>
                        {overlayContent}
                    </div>
                )}
                <input
                    ref={ref}
                    id={id}
                    type='search'
                    title={resolvedTitle}
                    aria-label={accessibleName}
                    aria-labelledby={resolvedAriaLabelledBy}
                    autoComplete={autoComplete}
                    placeholder={overlayVisible ? '' : (placeholder || 'Search…')}
                    className={cn('search-input font-size-2 color-primary flex-1', variant === 'small' && 'search-input--small', className, overlayVisible && 'search-input--with-overlay')}
                    {...props}
                />
            </div>
        </div>
    );
});

SearchInput.displayName = 'SearchInput';

export default SearchInput;
