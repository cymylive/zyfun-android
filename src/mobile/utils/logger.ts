/**
 * 移动端 logger —— 替代 @logger (winston)
 */
type Level = 'silly' | 'debug' | 'info' | 'warn' | 'error';

const noop = () => {};

const makeLogger = (context: string) => ({
  silly: (...args: any[]) => console.debug(`[${context}]`, ...args),
  debug: (...args: any[]) => console.debug(`[${context}]`, ...args),
  info: (...args: any[]) => console.info(`[${context}]`, ...args),
  warn: (...args: any[]) => console.warn(`[${context}]`, ...args),
  error: (...args: any[]) => console.error(`[${context}]`, ...args),
  withContext: (ctx: string) => makeLogger(`${context}:${ctx}`),
  finish: noop,
});

export const loggerService = {
  ...makeLogger('mobile'),
  withContext: (ctx: string) => makeLogger(ctx),
  finish: noop,
};

export default loggerService;
