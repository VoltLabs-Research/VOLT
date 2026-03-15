const { stopRuntimeContext } = require('./runtime.cjs');

afterAll(async () => {
    await stopRuntimeContext();
});
