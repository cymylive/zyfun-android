/**
 * 移动端页面桥 —— 在 renderer 组件与移动端容器之间传递播放/浏览请求。
 *
 * renderer 的组件（如 DialogDetail）通过 CALL_PLAYER / WINDOW_PLAYER 触发播放，
 * shim 把这些转成 router.push('/player')。player 页面 (原 renderer 的 player) 从
 * pinia player store 读数据 —— 这部分完全复用桌面逻辑，无需改动。
 *
 * 唯一需要处理的: 桌面版 player 页在独立窗口，移动端在同一 WebView 里，
 * 需要保证 store 状态同步（同进程，天然共享）。
 */
import { usePlayerStore } from '@/store';

export function setPlayerData(data: any) {
  const store = usePlayerStore();
  store.updateConfig({ status: true, ...data });
}

export function clearPlayerData() {
  const store = usePlayerStore();
  store.updateConfig({ status: false });
}
