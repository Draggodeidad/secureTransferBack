import pino from "pino";

const isDevelopment = process.env["NODE_ENV"] === "development";

const loggerOptions: pino.LoggerOptions = {
  level: process.env["LOG_LEVEL"] || "info",
};

if (isDevelopment) {
  loggerOptions.transport = {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
    },
  };
}

const logger = pino(loggerOptions);

export default logger;
