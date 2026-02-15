import * as dotenv from 'dotenv';
import * as path from 'path';

// CORE-022: Use path relative to this file, not CWD
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
