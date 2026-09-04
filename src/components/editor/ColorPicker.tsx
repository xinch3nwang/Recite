import { useEffect, useRef, useState } from 'react';
import { Pipette } from 'lucide-react';

/** 预设文本颜色（色板） */
const TEXT_COLORS = [
  '#111827', // 近黑
  '#6b7280', // 灰
  '#dc2626', // 红
  '#ea580c', // 橙
  '#d97706', // 琥珀
  '#16a34a', // 绿
  '#0d9488', // 青
  '#2563eb', // 蓝
  '#7c3aed', // 紫
  '#be185d', // 玫红
];

/** 预设荧光笔颜色（半透明，模拟荧光笔效果） */
const HIGHLIGHT_COLORS = [
  'rgba(250, 204, 21, 0.45)', // 黄
  'rgba(52, 211, 153, 0.4)', // 绿
  'rgba(96, 165, 250, 0.4)', // 蓝
  'rgba(244, 114, 182, 0.4)', // 粉
  'rgba(251, 146, 60, 0.45)', // 橙
  'rgba(192, 132, 252, 0.4)', // 紫
  'rgba(45, 212, 191, 0.4)', // 青
];

const RECENT_KEY_PREFIX = 'recite_fmt_recent_';

interface ColorPickerProps {
  /** 'color' | 'highlight' */
  mode: 'color' | 'highlight';
  onPick: (value: string) => void;
  onClose: () => void;
}

function loadRecents(mode: string): string[] {
  try {
    const raw = localStorage.getItem(`${RECENT_KEY_PREFIX}${mode}`);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function saveRecent(mode: string, value: string): void {
  const list = [value, ...loadRecents(mode).filter((v) => v !== value)].slice(0, 8);
  try {
    localStorage.setItem(`${RECENT_KEY_PREFIX}${mode}`, JSON.stringify(list));
  } catch {
    /* 忽略存储失败 */
  }
}

/** 颜色选择器弹层：预设色板 + 自定义取色 + 最近使用 */
export function ColorPicker({ mode, onPick, onClose }: ColorPickerProps) {
  const palette = mode === 'color' ? TEXT_COLORS : HIGHLIGHT_COLORS;
  const panelRef = useRef<HTMLDivElement>(null);
  const [recents, setRecents] = useState<string[]>(() => loadRecents(mode));

  // 点击面板外部关闭
  useEffect(() => {
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [onClose]);

  const pick = (value: string) => {
    saveRecent(mode, value);
    setRecents(loadRecents(mode));
    onPick(value);
    onClose();
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={mode === 'color' ? '文本颜色' : '荧光笔颜色'}
      className="w-56 rounded-xl border border-stone-200 bg-white p-3 shadow-xl animate-[fadeIn_0.15s_ease-out] dark:border-stone-700/60 dark:bg-stone-900"
    >
      <p className="mb-2 text-xs font-medium text-stone-500 dark:text-stone-400">预设颜色</p>
      <div className="flex flex-wrap gap-1.5">
        {palette.map((c) => (
          <button
            key={c}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(c)}
            aria-label={`选择颜色 ${c}`}
            title={c}
            className="h-7 w-7 rounded-full border border-stone-200 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:border-stone-700/60"
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      <p className="mb-2 mt-3 text-xs font-medium text-stone-500 dark:text-stone-400">最近使用</p>
      {recents.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {recents.map((c) => (
            <button
              key={c}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(c)}
              aria-label={`最近颜色 ${c}`}
              title={c}
              className="h-7 w-7 rounded-full border border-stone-200 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:border-stone-700/60"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-stone-300 dark:text-stone-500">暂无最近使用</p>
      )}

      <p className="mb-1 mt-3 text-xs font-medium text-stone-500 dark:text-stone-400">自定义</p>
      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-stone-200 px-2.5 py-1.5 transition-colors hover:border-amber-400 dark:border-stone-700/60">
        <Pipette size={14} className="text-stone-400 dark:text-stone-500" aria-hidden="true" />
        <span className="text-xs text-stone-500 dark:text-stone-400">选取颜色</span>
        <input
          type="color"
          defaultValue={mode === 'color' ? '#111827' : '#fde047'}
          onInput={(e) => {
            // color 输入实时反馈；离开时提交。对 highlight 模式保持半透明预演
            const v = e.currentTarget.value;
            e.currentTarget.style.setProperty('--live', v);
          }}
          onChange={(e) => {
            const v = e.currentTarget.value;
            if (mode === 'color') pick(v);
            else pick(hexToRgba(v));
          }}
          className="ml-auto h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
          aria-label="自定义颜色"
        />
      </label>
    </div>
  );
}

/** 把十六进制颜色转为半透明 rgba（用于荧光笔自定义色） */
function hexToRgba(hex: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, 0.45)`;
}
