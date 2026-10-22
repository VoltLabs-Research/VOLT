import { applyScreenTheme } from '@/modules/marketing/utils/screen-theme';
import { isolateScreenFocus } from '@/modules/marketing/utils/screen-focus';
import { isolateScreenStorage } from '@/modules/marketing/utils/screen-storage';

// The app's modules read storage and the theme as they load, so a landing screen isolates
// the one and sets the other before any of them is imported, and keeps whatever the app
// focuses from scrolling the page that shows it.
isolateScreenStorage();
applyScreenTheme(window.location.search);
isolateScreenFocus();
