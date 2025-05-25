import logging

logging.getLogger('numba.cuda.cudadrv.driver').setLevel(logging.WARNING)

def setup_logging(verbose: bool = False) -> logging.Logger:
    handler = logging.StreamHandler()
    formatter = logging.Formatter(
        '%(asctime)s %(processName)s %(levelname)s ▶ %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    handler.setFormatter(formatter)
    logger = logging.getLogger()
    logger.addHandler(handler)

    logger.setLevel(logging.DEBUG if verbose else logging.INFO)
    return logger

def time_function(func):
    import time
    import functools
    
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.perf_counter()
        result = func(*args, **kwargs)
        end_time = time.perf_counter()
        execution_time = end_time - start_time
        
        # Get logger from context if available
        ctx = args[0] if args and isinstance(args[0], dict) and 'logger' in args[0] else None
        logger = ctx['logger'] if ctx else logging.getLogger()
        
        logger.info(f'{func.__name__} completed in {execution_time:.3f}s')
        return result
    return wrapper
