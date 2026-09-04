import { useEffect, useState } from 'react';

/** 开屏展示时长（logo 入场动画完成后停留），ms */
const SPLASH_HOLD_MS = 1300;
/** 开屏整体淡出时长，ms */
const SPLASH_FADE_MS = 600;

/**
 * 开屏界面：居中展示应用 logo 与其下方说明文字，入场带平滑动画，
 * 停留后整体淡出，平稳过渡到主界面（消除生硬切换）。
 */
export function SplashScreen() {
  const [exiting, setExiting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t1 = window.setTimeout(() => setExiting(true), SPLASH_HOLD_MS);
    const t2 = window.setTimeout(() => setDone(true), SPLASH_HOLD_MS + SPLASH_FADE_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  if (done) return null;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-[#F9F7F2] transition-opacity duration-500 dark:bg-[#0C0A09] ${
        exiting ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center">
        <img
          src="/icon-192x192.png"
          alt="忆读"
          draggable={false}
          className="h-24 w-24 animate-[splashEnter_0.6s_ease-out_both] rounded-[1.4rem] shadow-lg"
        />
        <p className="mt-4 animate-[fadeIn_0.6s_ease-out_0.15s_both] text-sm text-stone-500 dark:text-stone-400">
          隐藏重点内容，辅助记忆与复习
        </p>
      </div>
    </div>
  );
}