/**
 * t3Drpy worker —— 移动端已废弃。
 *
 * 桌面版用 workerpool 开子进程跑 drpy2.min.js（见 src/main/...）；
 * 移动端没有子进程，由 index.ts 直接动态 import drpy2.min。
 *
 * 本文件保留仅为兼容可能的外部 import，不做任何事。
 */
export const DEPRECATED = true;
