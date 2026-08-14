// Minimal leveled logger — adds an ISO timestamp and a level tag to every line.
// Error objects are passed through untouched so their stack trace still prints.

const timestamp = () => new Date().toISOString();

const serialize = (arg) => {
  if (arg instanceof Error) return arg;
  if (typeof arg === "object" && arg !== null) {
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  }
  return arg;
};

const write = (level, args) =>
  console[level](`[${timestamp()}] [${level.toUpperCase()}]`, ...args.map(serialize));

const logger = {
  info: (...args) => write("info", args),
  warn: (...args) => write("warn", args),
  error: (...args) => write("error", args),
};

export default logger;
