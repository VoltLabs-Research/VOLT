from opendxa import DislocationAnalysis, Logger

logger = Logger()

# Supported levels: INFO | DEBUG | WARN | ERROR | FATAL
logger.set_level('INFO')

# If True, prints the logs to the console. 
# This method is useful if you want to write the 
# log to a file and avoid having to display it on 
# the console; in that case, it's best to leave it set to False.
logger.enable_console(True)

logger.enable_timestamp(False)
logger.enable_thread_id(False)

logger.set_log_file('analysis.log')

pipeline = DislocationAnalysis()
pipeline.compute('dump_file')