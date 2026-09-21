/**
 * 移动端更新 —— 走 GitHub Release 检查 APK 新版本
 * 桌面版用 electron-updater，移动端手工检查 GitHub API。
 */
const REPO = 'cymylive/zyfun-android';
const RELEASE_API = `https://api.github.com/repos/${REPO}/releases/latest`;

export interface IMobileRelease {
  tag: string;
  name: string;
  apkUrl: string;
  body: string;
  publishedAt: string;
}

export async function checkMobileUpdate(currentVersion: string): Promise<IMobileRelease | null> {
  try {
    const resp = await fetch(RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!resp.ok) return null;
    const data = await resp.json();

    const tag = String(data.tag_name ?? '').replace(/^v/, '');
    if (!tag || tag === currentVersion) return null;

    const apk = (data.assets ?? []).find((a: any) => String(a.name).endsWith('.apk'));
    if (!apk) return null;

    return {
      tag,
      name: data.name ?? tag,
      apkUrl: apk.browser_download_url,
      body: data.body ?? '',
      publishedAt: data.published_at ?? '',
    };
  } catch {
    return null;
  }
}

export function openApkDownload(url: string) {
  window.open(url, '_blank', 'noopener');
}
