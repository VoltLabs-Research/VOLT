#ifndef __LOGGER_MANAGER_HPP
#define __LOGGER_MANAGER_HPP

#include <opendxa/logger/logger.hpp>
#include <memory>

extern std::shared_ptr<Logger> globalLogger;

class LoggerManager {
public:
    static void initialize(const std::string& name = "Global") {
        if (!globalLogger) {
            globalLogger = std::make_shared<Logger>(name);
        }
    }

    static void initialize(std::shared_ptr<Logger> logger) {
        globalLogger = logger;
    }

    static Logger& get() {
        if (!globalLogger) {
            initialize();
        }
        return *globalLogger;
    }

    static void shutdown() {
        globalLogger.reset();
    }

    static bool isInitialized() {
        return globalLogger != nullptr;
    }
};

inline auto LOG_DEBUG() { return LoggerManager::get().debug(); }
inline auto LOG_INFO() { return LoggerManager::get().info(); }
inline auto LOG_WARN() { return LoggerManager::get().warn(); }
inline auto LOG_ERROR() { return LoggerManager::get().error(); }
inline auto LOG_FATAL() { return LoggerManager::get().fatal(); }

#endif