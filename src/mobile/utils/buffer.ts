/**
 * node:buffer 的浏览器实现
 */
export const Buffer = {
  from(input: any, encoding?: string): Uint8Array {
    if (typeof input === 'string') {
      if (encoding === 'base64') {
        const bin = atob(input);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return arr;
      }
      if (encoding === 'hex') {
        const bytes = input.match(/.{2}/g) || [];
        return new Uint8Array(bytes.map((b) => parseInt(b, 16)));
      }
      return new TextEncoder().encode(input);
    }
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (Array.isArray(input)) return new Uint8Array(input);
    return new Uint8Array(0);
  },
  isBuffer: (v: any): boolean => v instanceof Uint8Array,
  alloc: (size: number) => new Uint8Array(size),
  concat: (arrs: Uint8Array[]) => {
    const total = arrs.reduce((s, a) => s + a.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const a of arrs) {
      out.set(a, off);
      off += a.length;
    }
    return out;
  },
};

export default { Buffer };
