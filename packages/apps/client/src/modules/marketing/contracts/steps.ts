// Where the page is wide enough to pin a screen while its steps go by; landing.css pins at
// the same width.
export const PINNED_MEDIA_QUERY = '(width >= 64rem)';

// How the page numbers the steps it walks through: 01, 02…
export const stepNumber = (index: number): string => String(index + 1).padStart(2, '0');
