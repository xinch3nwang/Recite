import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { seedBuiltinDocuments } from '@/utils/seedDocuments'
import './index.css'

// 首次启动注入内置示例文档（幂等，用户删除后不复活），完成后再渲染
void seedBuiltinDocuments().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
