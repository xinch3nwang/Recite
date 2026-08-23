import { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import Home from '@/pages/Home';
import Reader from '@/pages/Reader';
import FileManager from '@/pages/FileManager';
import Quiz from '@/pages/Quiz';
import Unmastered from '@/pages/Unmastered';
import { useReciteStore } from '@/store/useReciteStore';

// 安卓返回键：阅读页返回首页，首页退出应用
function BackButtonHandler() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = CapacitorApp.addListener('backButton', () => {
      if (location.pathname === '/') {
        CapacitorApp.exitApp();
        return;
      }

      const state = useReciteStore.getState();
      state.saveCurrentProgress();
      if (state.currentDoc) {
        state.addToRecent({
          id: state.currentDoc.id,
          title: state.currentDoc.title,
          progressPercent: state.progress?.progressPercent || 0,
          lastReadAt: Date.now(),
        });
      }

      // 遵循层级导航：阅读页返回上一级界面，其他子页面返回首页
      if (location.pathname === '/reader') {
        const from = new URLSearchParams(location.search).get('from');
        navigate(from === 'files' ? '/files' : '/', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    });

    return () => {
      listener.then((l) => l.remove()).catch(() => {});
    };
  }, [location, navigate]);

  return null;
}

export default function App() {
  return (
    <Router>
      <BackButtonHandler />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/reader" element={<Reader />} />
        <Route path="/files" element={<FileManager />} />
        <Route path="/quiz" element={<Quiz />} />
        <Route path="/unmastered" element={<Unmastered />} />
      </Routes>
    </Router>
  );
}
