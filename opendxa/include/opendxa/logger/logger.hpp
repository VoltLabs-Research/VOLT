#ifndef __LOGGER_HPP
#define __LOGGER_HPP

#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <memory>
#include <mutex>
#include <chrono>
#include <iomanip>
#include <thread>
#include <stdexcept>

enum class LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    FATAL = 4
};

class Logger {
public:
    Logger(const std::string& name = "Default");
    ~Logger();

    // Configuración
    void setLevel(LogLevel level) { minLevel = level; }
    void setOutputStream(std::shared_ptr<std::ostream> stream) { outputStream = stream; }
    void setLogToFile(const std::string& filename);
    void setLogToConsole(bool enable = true);
    void enableTimestamp(bool enable = true) { showTimestamp = enable; }
    void enableThreadId(bool enable = true) { showThreadId = enable; }

    class LogStream {
    public:
        LogStream(Logger& logger, LogLevel level) : logger_(logger), level_(level), moved_(false) {}
        
        LogStream(LogStream&& other) noexcept 
            : logger_(other.logger_), level_(other.level_), stream_(std::move(other.stream_)), moved_(false) {
            other.moved_ = true;
        }
        
        template<typename T>
        LogStream& operator<<(const T& value) {
            if (!moved_ && logger_.shouldLog(level_)) {
                stream_ << value;
            }
            return *this;
        }

        ~LogStream() noexcept {
            if (!moved_ && logger_.shouldLog(level_)) {
                std::string message = stream_.str();
                if (!message.empty()) {
                    try {
                        logger_.log(level_, message);
                        
                        if (level_ == LogLevel::FATAL) {
                            logger_.setFatalOccurred(true);
                        }
                    } catch (...) {
                    }
                }
            }
        }

        LogStream(const LogStream&) = delete;
        LogStream& operator=(const LogStream&) = delete;
        LogStream& operator=(LogStream&&) = delete;

    private:
        Logger& logger_;
        LogLevel level_;
        std::stringstream stream_;
        bool moved_;
    };

    // Métodos que retornan LogStream para concatenación
    LogStream debug() { return LogStream(*this, LogLevel::DEBUG); }
    LogStream info() { return LogStream(*this, LogLevel::INFO); }
    LogStream warn() { return LogStream(*this, LogLevel::WARN); }
    LogStream error() { return LogStream(*this, LogLevel::ERROR); }
    LogStream fatal() { return LogStream(*this, LogLevel::FATAL); }

    bool shouldLog(LogLevel level) const { return level >= minLevel; }
    void setFatalOccurred(bool occurred) { fatalOccurred = occurred; }
    bool hasFatalOccurred() const { return fatalOccurred; }
    void clearFatalFlag() { fatalOccurred = false; }

private:
    void log(LogLevel level, const std::string& message);
    std::string formatMessage(LogLevel level, const std::string& message);
    std::string getCurrentTimestamp();
    std::string levelToString(LogLevel level);

private:
    std::string loggerName;
    LogLevel minLevel;
    std::shared_ptr<std::ostream> outputStream;
    std::shared_ptr<std::ofstream> fileStream;  // CAMBIO: ahora es shared_ptr
    bool logToConsole;
    bool showTimestamp;
    bool showThreadId;
    bool fatalOccurred;
    mutable std::mutex logMutex;
};

#endif