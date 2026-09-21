/**
 * node:path 的浏览器实现 —— 移动端只用最基础的功能
 */
export const join = (...parts: string[]): string =>
  parts
    .filter(Boolean)
    .map((p, i) => (i === 0 ? p.replace(/[\\/]+$/, '') : p.replace(/^[\\/]+|[\\/]+$/g, '')))
    .join('/');

export const resolve = (...parts: string[]): string => join(...parts);

export const basename = (p: string): string => p.split(/[\\/]/).pop() ?? '';

export const dirname = (p: string): string => {
  const parts = p.split(/[\\/]/);
  parts.pop();
  return parts.join('/') || '.';
};

export const extname = (p: string): string => {
  const b = basename(p);
  const i = b.lastIndexOf('.');
  return i > 0 ? b.slice(i) : '';
};

export const isAbsolute = (p: string): boolean => /^([a-zA-Z]:)?[\\/]/.test(p);

export const sep = '/';

export default { join, resolve, basename, dirname, extname, isAbsolute, sep };
