import { describe, it, expect, beforeEach } from 'vitest';
import {
  createShare,
  getShareRecord,
  validateShareAccess,
  revokeShare,
  isShareExpired,
  safeTokenEqual,
  pruneExpiredShares,
  buildShareLink,
  parseShareParams,
  generateToken,
  SHARE_DEFAULT_TTL,
  SHARE_STORAGE_KEY,
  type ShareRecord,
} from '@/utils/share';

/** 将指定分享记录标记为已过期并写回存储 */
function forceExpire(record: ShareRecord): ShareRecord {
  const expired = { ...record, expiresAt: Date.now() - 1 };
  localStorage.setItem(SHARE_STORAGE_KEY, JSON.stringify([expired]));
  return expired;
}

describe('分享令牌生成', () => {
  it('generateToken 对相同输入稳定', () => {
    expect(generateToken('d1', 's1', 'salt')).toBe(generateToken('d1', 's1', 'salt'));
    expect(generateToken('d1', 's1', 'salt')).not.toBe(generateToken('d1', 's1', 'salt2'));
  });

  it('safeTokenEqual 恒定时间比较', () => {
    expect(safeTokenEqual('abc', 'abc')).toBe(true);
    expect(safeTokenEqual('abc', 'abd')).toBe(false);
    expect(safeTokenEqual('abc', 'a')).toBe(false);
    expect(safeTokenEqual('', '')).toBe(true);
  });
});

describe('创建与存储', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('createShare 返回带令牌的记录并写入存储', () => {
    const before = Date.now();
    const record = createShare('d1');
    expect(record.docId).toBe('d1');
    expect(record.token).toBeTruthy();
    expect(record.createdAt).toBeGreaterThanOrEqual(before);
    expect(record.expiresAt - record.createdAt).toBe(SHARE_DEFAULT_TTL);
    expect(getShareRecord(record.shareId)?.shareId).toBe(record.shareId);
  });

  it('createShare 支持自定义有效期', () => {
    const record = createShare('d1', 60 * 1000);
    expect(record.expiresAt - record.createdAt).toBe(60 * 1000);
  });

  it('getShareRecord 不存在返回 null', () => {
    expect(getShareRecord('nope')).toBeNull();
  });
});

describe('安全访问验证', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('携带正确令牌且未过期时放行', () => {
    const record = createShare('d1');
    const result = validateShareAccess(record.shareId, record.token);
    expect(result.ok).toBe(true);
    if (result.ok && result.record) expect(result.record.docId).toBe('d1');
  });

  it('错误令牌被拒绝（防未授权访问）', () => {
    const record = createShare('d1');
    const result = validateShareAccess(record.shareId, 'wrong-token');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('bad_token');
  });

  it('不存在的分享 id 返回 not_found', () => {
    const result = validateShareAccess('missing', 'anything');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('not_found');
  });

  it('过期分享返回 expired', () => {
    const record = createShare('d1', 1000);
    const expired = forceExpire(record);
    const result = validateShareAccess(record.shareId, record.token);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('expired');
    expect(isShareExpired(expired)).toBe(true);
  });

  it('revokeShare 撤销后无法访问', () => {
    const record = createShare('d1');
    revokeShare(record.shareId);
    expect(validateShareAccess(record.shareId, record.token).ok).toBe(false);
  });

  it('pruneExpiredShares 清理过期记录', () => {
    const record = createShare('d1');
    forceExpire(record);
    pruneExpiredShares();
    expect(getShareRecord(record.shareId)).toBeNull();
  });

  it('pruneExpiredShares 保留未过期记录', () => {
    const record = createShare('d1');
    pruneExpiredShares();
    expect(getShareRecord(record.shareId)).not.toBeNull();
  });
});

describe('分享链接', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('buildShareLink 包含 shareId 与 token', () => {
    const record = createShare('d1');
    const link = buildShareLink(record);
    expect(link).toContain(`#/share/${encodeURIComponent(record.shareId)}`);
    expect(link).toContain(`token=${encodeURIComponent(record.token)}`);
  });

  it('parseShareParams 解析或拒绝缺参', () => {
    expect(parseShareParams('s1', 't1')).toEqual({ shareId: 's1', token: 't1' });
    expect(parseShareParams(null, 't1')).toBeNull();
    expect(parseShareParams('s1', null)).toBeNull();
  });
});
