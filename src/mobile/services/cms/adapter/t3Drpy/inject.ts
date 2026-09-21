/**
 * drpy 注入层 —— 移动端实现
 *
 * 关键差异: 桌面版 req() 是同步的（hiker syncFetch 基于 child_process），
 * 移动端用同步 XHR 实现，行为等价。
 */
import { Buffer } from '@mobile/utils/buffer';
import { batchFetch } from '@mobile/services/hiker/request/asyncAxios';
import { syncRequest } from '@mobile/services/hiker/sync-request';
import JSON5 from 'json5';

const hasPropertyIgnoreCase = (obj: Record<string, string>, propertyName: string) => {
  return Object.keys(obj).some((key) => key.toLowerCase() === propertyName.toLowerCase());
};

const valueStartsWith = (obj: Record<string, string>, propertyName: string, prefix: string) => {
  const key = Object.keys(obj).find((key) => key.toLowerCase() === propertyName.toLowerCase());
  return key !== undefined && obj[key].startsWith(prefix);
};

const req = (url: string, cobj: Record<string, any>): { content: string; headers?: Record<string, string> } => {
  const obj = { ...cobj };

  try {
    if (obj.data) {
      obj.body = obj.data;
      const isForm =
        obj.postType === 'form' ||
        (hasPropertyIgnoreCase(obj.headers, 'Content-Type') &&
          valueStartsWith(obj.headers, 'Content-Type', 'application/x-www-form-urlencoded'));

      if (isForm) {
        obj.headers = obj.headers || {};
        obj.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        obj.body = new URLSearchParams(obj.data).toString();
        delete obj.postType;
      }
      delete obj.data;
    }

    if (Object.hasOwn(obj, 'redirect')) obj.redirect = !!obj.redirect;
    if (obj.buffer === 2) obj.toHex = true;

    if (url === 'https://api.nn.ci/ocr/b64/text' && obj.headers) {
      obj.headers['Content-Type'] = 'text/plain';
    }

    const raw = syncRequest(url, obj as any);

    const res: { content: string; headers?: Record<string, string> } = { content: '' };
    if (obj.withHeaders) {
      res.content = raw.content;
      res.headers = raw.headers ?? {};
    } else {
      res.content = raw.content;
    }

    if (obj.buffer === 2) {
      // hex -> base64
      const hex = raw.content || '';
      const bytes = new Uint8Array((hex.match(/.{2}/g) || []).map((b) => parseInt(b, 16)));
      let bin = '';
      for (const b of bytes) bin += String.fromCharCode(b);
      res.content = btoa(bin);
    }

    return res;
  } catch (error) {
    console.error(error);
    if (obj.withHeaders) return { headers: {}, content: '' };
    return { content: '' };
  }
};

export { batchFetch, req };
export { joinUrl, local, pd, pdfa, pdfh } from '@mobile/services/hiker';
