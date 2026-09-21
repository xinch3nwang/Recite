/**
 * 内置示例文档首次启动注入：
 * - 通过 localStorage 标记位保证每个内置文档只注入一次；
 * - 已全部注入时同步返回，不加载文档内容块（零运行时开销）；
 * - 首次启动才异步加载内置文档大块数据，注入完成后再渲染；
 * - 用户删除后不会复活（标记位仍在）；
 * - 无 localStorage 环境（SSR / 严格隐私模式）静默跳过。
 */
import { BUILTIN_DOCUMENTS } from '@/data/builtinDocuments';
import {
  saveDocument,
  getDocument,
  addRecentDocument,
} from '@/utils/storage';

const SEED_FLAG_KEY = 'recite_builtin_seeded';

/** 内置文档使用固定的较早时间戳，保证列表排序稳定 */
const BUILTIN_TIME = new Date('2024-01-01T00:00:00').getTime();

export async function seedBuiltinDocuments(): Promise<void> {
  let seeded: string[] = [];
  try {
    const raw = localStorage.getItem(SEED_FLAG_KEY);
    seeded = raw ? (JSON.parse(raw) as string[]) : [];
    if (!Array.isArray(seeded)) seeded = [];
  } catch {
    seeded = [];
  }

  const pending = BUILTIN_DOCUMENTS.filter((doc) => !seeded.includes(doc.id));
  // 已全部注入：不加载任何正文分包
  if (pending.length === 0) return;

  try {
    const next = [...seeded];
    for (const builtin of pending) {
      if (!getDocument(builtin.id)) {
        const content = await builtin.loadContent();
        saveDocument({
          id: builtin.id,
          title: builtin.title,
          content,
          createdAt: BUILTIN_TIME,
          updatedAt: BUILTIN_TIME,
          type: 'document',
        });
        addRecentDocument({
          id: builtin.id,
          title: builtin.title,
          progressPercent: 0,
          lastReadAt: BUILTIN_TIME,
        });
      }
      next.push(builtin.id);
    }
    localStorage.setItem(SEED_FLAG_KEY, JSON.stringify(next));
  } catch {
    // localStorage 或正文分包加载失败时静默忽略，下次启动重试
  }
}
