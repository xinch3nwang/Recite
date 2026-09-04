/**
 * 分享功能：为文档的编辑图生成带访问令牌的分享链接。
 * 纯前端环境下通过「签名令牌 + 有效期」实现访问验证：
 * - 仅凭分享 id 无法访问，必须携带有效令牌（防止未授权访问）；
 * - 分享可设置有效期，过期后自动失效；
 * - 令牌比较采用恒定时间比较，避免时序攻击。
 */
import { createId } from '@/utils/diagram';

export const SHARE_STORAGE_KEY = 'recite_shares';
export const SHARE_DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 默认 7 天

export interface ShareRecord {
  shareId: string;
  docId: string;
  /** 生成令牌时使用的随机盐 */
  salt: string;
  /** 访问令牌（签名值，随分享链接传递） */
  token: string;
  createdAt: number;
  expiresAt: number;
}

/** djb2 哈希：由文档/分享 id 与随机盐生成确定性的签名值 */
function hash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  }
  return `${h.toString(36)}_${input.length.toString(36)}`;
}

/** 生成访问令牌 */
export function generateToken(docId: string, shareId: string, salt: string): string {
  return hash(`${docId}::${shareId}::${salt}`);
}

/** 恒定时间字符串比较，避免时序攻击 */
export function safeTokenEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function readAll(): ShareRecord[] {
  try {
    const raw = localStorage.getItem(SHARE_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as ShareRecord[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeAll(list: ShareRecord[]): void {
  try {
    localStorage.setItem(SHARE_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Ignore storage errors
  }
}

/** 清理已过期的分享记录（避免表无限膨胀） */
export function pruneExpiredShares(): void {
  const now = Date.now();
  writeAll(readAll().filter((r) => r.expiresAt > now));
}

/** 创建分享：返回分享记录，令牌已按「文档+分享id+随机盐」签名 */
export function createShare(
  docId: string,
  ttlMs: number = SHARE_DEFAULT_TTL
): ShareRecord {
  pruneExpiredShares();
  const shareId = createId('share');
  const salt = Math.random().toString(36).slice(2, 10);
  const now = Date.now();
  const record: ShareRecord = {
    shareId,
    docId,
    salt,
    token: generateToken(docId, shareId, salt),
    createdAt: now,
    expiresAt: now + ttlMs,
  };
  writeAll([...readAll(), record]);
  return record;
}

/** 读取指定分享记录 */
export function getShareRecord(shareId: string): ShareRecord | null {
  return readAll().find((r) => r.shareId === shareId) ?? null;
}

/** 是否已过期 */
export function isShareExpired(record: ShareRecord): boolean {
  return record.expiresAt <= Date.now();
}

export interface ShareAccessResult {
  ok: boolean;
  /** 验证通过时的分享记录 */
  record?: ShareRecord;
  /** 验证失败原因（仅 ok=false 时） */
  reason?: 'not_found' | 'bad_token' | 'expired';
}

/**
 * 安全验证：分享必须携带有效令牌且未过期才允许访问。
 * 防止仅凭分享 id 的未授权访问。
 */
export function validateShareAccess(shareId: string, token: string): ShareAccessResult {
  const record = getShareRecord(shareId);
  if (!record) return { ok: false, reason: 'not_found' };
  if (!safeTokenEqual(record.token, token)) return { ok: false, reason: 'bad_token' };
  if (isShareExpired(record)) return { ok: false, reason: 'expired' };
  return { ok: true, record };
}

/** 撤销分享 */
export function revokeShare(shareId: string): void {
  writeAll(readAll().filter((r) => r.shareId !== shareId));
}

/** 构建分享链接（HashRouter 形式，携带令牌） */
export function buildShareLink(record: ShareRecord): string {
  return `#/share/${encodeURIComponent(record.shareId)}?token=${encodeURIComponent(record.token)}`;
}

/** 解析分享链接中的 shareId 与 token */
export function parseShareParams(
  shareId: string | null,
  token: string | null
): { shareId: string; token: string } | null {
  if (!shareId || !token) return null;
  return { shareId, token };
}
