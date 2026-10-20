interface QaCheckHarness {
    check(label: string, actual: unknown, expected: unknown): void;
    finish(): never;
}

export const createQaCheckHarness = (labelWidth: number): QaCheckHarness => {
    let failures = 0;

    const check = (label: string, actual: unknown, expected: unknown): void => {
        const ok = JSON.stringify(actual) === JSON.stringify(expected);
        if (!ok) failures += 1;
        console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label.padEnd(labelWidth)} esperado=${JSON.stringify(expected)} obtenido=${JSON.stringify(actual)}`);
    };

    const finish = (): never => {
        console.log(`\n${failures === 0 ? 'TODO OK' : `${failures} FALLOS`}`);
        process.exit(failures === 0 ? 0 : 1);
    };

    return {
        check,
        finish
    };
};
