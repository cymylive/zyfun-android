/**
 * electron 类型 stub —— 移动端构建时替代 import type ... from 'electron'
 * 只提供 renderer 用到的类型定义。
 */
export interface WebviewTag extends HTMLElement {
  src: string;
  loadURL(url: string): Promise<void>;
  getWebContentsId(): number;
  remove(): void;
}

export interface DidNavigateEvent {
  url: string;
}

export interface DidNavigateInPageEvent {
  url: string;
  isMainFrame: boolean;
}

export interface DidRedirectNavigationEvent {
  url: string;
}

export interface PageTitleUpdatedEvent {
  title: string;
}

export interface PageFaviconUpdatedEvent {
  favicons: string[];
}
