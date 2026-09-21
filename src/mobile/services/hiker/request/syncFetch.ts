/**
 * 移动端无同步 HTTP，降级为 async fetch 的同名导出
 * 用到的适配器（t3Xyq/t3Xbpq）在移动端都只在异步上下文调用这些函数，安全。
 */
export { batchFetch, bf, fetch, fetchCookie, fetchPC, post, postPC, request } from './asyncAxios';
