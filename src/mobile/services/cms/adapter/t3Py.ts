/**
 * t3Py —— Python 源
 * 移动端无 Python 运行时，暂不支持。保留类结构以便导入不报错。
 */
import type { ICmsResultPromise } from '@shared/types/cms';

class T3PyAdapter {
  async init(): ICmsResultPromise['init'] {}
  async home(): ICmsResultPromise['home'] {
    throw new Error('mobile: Python source not supported yet');
  }
  async homeVod(): ICmsResultPromise['homeVod'] {
    throw new Error('mobile: Python source not supported yet');
  }
  async category(): ICmsResultPromise['category'] {
    throw new Error('mobile: Python source not supported yet');
  }
  async detail(): ICmsResultPromise['detail'] {
    throw new Error('mobile: Python source not supported yet');
  }
  async search(): ICmsResultPromise['search'] {
    throw new Error('mobile: Python source not supported yet');
  }
  async play(): ICmsResultPromise['play'] {
    throw new Error('mobile: Python source not supported yet');
  }
  async action(): ICmsResultPromise['action'] {
    return '';
  }
  async proxy(): ICmsResultPromise['proxy'] {
    return [];
  }
  async runMain(): ICmsResultPromise['runMain'] {
    return '';
  }
}

export default T3PyAdapter;
