import { useEffect, useState } from 'react';

/**
 * 防抖 Hook：输入变化后延迟 delay 毫秒再更新返回值。
 * 用于搜索框，避免每次击键都触发全文检索。
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(value);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
