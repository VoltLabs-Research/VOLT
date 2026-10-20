export const resolveSystemPython = (): string =>
    process.env.VOLT_PYTHON
    || process.env.ASE_PYTHON
    || (process.platform === 'win32' ? 'python' : 'python3');

export const missingPythonMessage = (command: string): string =>
    `Python 3.12+ is required for plugins and ASE exports, but "${command}" is not available. `
    + 'Install Python and add it to PATH, or set VOLT_PYTHON to the interpreter.';
