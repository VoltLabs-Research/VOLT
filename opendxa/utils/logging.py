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
    