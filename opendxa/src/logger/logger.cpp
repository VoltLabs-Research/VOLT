#include <opendxa/logger/logger.hpp>

Logger::Logger(const std::string& name) 
    : loggerName(name)
    , minLevel(LogLevel::INFO)
    , outputStream(std::shared_ptr<std::ostream>(&std::cout, [](std::ostream*){}))
    , logToConsole(true)
    , showTimestamp(true)
    , showThreadId(false)
    , fatalOccurred(false) {
}

Logger::~Logger(){
    if(fileStream && fileStream->is_open()){
        fileStream->close();
    }
}

void Logger::setLogToFile(const std::string& filename){
    std::lock_guard<std::mutex> lock(logMutex);
    fileStream = std::make_shared<std::ofstream>(filename, std::ios::app);
    if(!fileStream->is_open()){
        throw std::runtime_error("Failed to open log file: " + filename);
    }
}

void Logger::setLogToConsole(bool enable){
    std::lock_guard<std::mutex> lock(logMutex);
    logToConsole = enable;
    if(enable){
        outputStream = std::shared_ptr<std::ostream>(&std::cout, [](std::ostream*){});
    }
}

void Logger::log(LogLevel level, const std::string& message){
    if(!shouldLog(level)) return;

    std::lock_guard<std::mutex> lock(logMutex);
    std::string formattedMessage = formatMessage(level, message);
    
    if(logToConsole){
        std::cout << formattedMessage << std::endl;
        std::cout.flush();
    }
    
    if(fileStream && fileStream->is_open()){
        *fileStream << formattedMessage << std::endl;
        fileStream->flush();
    }
}

std::string Logger::formatMessage(LogLevel level, const std::string& message){
    std::stringstream ss;
    
    if(showTimestamp){
        ss << "[" << getCurrentTimestamp() << "] ";
    }
    
    ss << "[" << levelToString(level) << "] ";
    
    if(showThreadId){
        ss << "[Thread-" << std::this_thread::get_id() << "] ";
    }
    
    // ss << "[" << loggerName << "] " << message;
    ss << message;
    
    return ss.str();
}

std::string Logger::getCurrentTimestamp(){
    auto now = std::chrono::system_clock::now();
    auto time_t = std::chrono::system_clock::to_time_t(now);
    
    std::stringstream ss;
    ss << std::put_time(std::gmtime(&time_t), "%Y-%m-%d %H:%M:%S");
    return ss.str();
}

std::string Logger::levelToString(LogLevel level){
    switch (level) {
        case LogLevel::DEBUG:
            return "DEBUG";
        case LogLevel::INFO:
            return "INFO";
        case LogLevel::WARN:
            return "WARN";
        case LogLevel::ERROR:
            return "ERROR";
        case LogLevel::FATAL:
            return "FATAL";
        default:
            return "UNKNOWN";
    }
}