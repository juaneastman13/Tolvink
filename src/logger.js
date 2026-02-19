// Structured logger — silenced in production unless VITE_DEBUG is set
const IS_DEV = import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true';

function fmt(prefix, args) { return [`[${prefix}]`, ...args]; }

const logger = {
  log:   (prefix, ...args) => { if (IS_DEV) console.log(...fmt(prefix, args)); },
  warn:  (prefix, ...args) => { if (IS_DEV) console.warn(...fmt(prefix, args)); },
  error: (prefix, ...args) => { console.error(...fmt(prefix, args)); }, // always log errors
};

export default logger;
