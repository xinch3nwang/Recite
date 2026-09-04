import { useLocation, useNavigate } from 'react-router-dom';
import { Home as HomeIcon, FolderOpen } from 'lucide-react';

/** 底部导航选项：路径、文案与图标 */
const NAV_ITEMS = [
  { path: '/', label: '首页', Icon: HomeIcon },
  { path: '/files', label: '文件管理', Icon: FolderOpen },
] as const;

/**
 * 底部主导航：仅主页面（首页/文件管理）显示。
 * 当前路由高亮选中态（琥珀色图标/文字 + 顶部指示条），点击切换页面。
 */
export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-stone-700/60 dark:bg-stone-900/95"
      aria-label="底部导航"
    >
      <div className="mx-auto flex max-w-3xl">
        {NAV_ITEMS.map(({ path, label, Icon }) => {
          const isActive = location.pathname === path;
          return (
            <button
              key={path}
              type="button"
              onClick={() => navigate(path)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-1 flex-col items-center gap-1 py-2.5 text-xs transition-colors ${
                isActive ? 'text-amber-600 dark:text-amber-400' : 'text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-100'
              }`}
            >
              <span
                className={`absolute top-0 h-0.5 w-8 rounded-full transition-colors ${
                  isActive ? 'bg-amber-500' : 'bg-transparent'
                }`}
              />
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
              <span className="font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
