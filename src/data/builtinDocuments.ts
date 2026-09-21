/**
 * 内置示例文档清单（仅元数据）。
 * 正文为同目录下独立的 *.html 文件（网站 Mubu 大纲格式，span.underline 为背诵重点），
 * 通过 Vite `?raw` 按需加载：仅首次启动注入时拉取该独立分包，不进入应用主包。
 * 新增内置文档：把 HTML 放入本目录，并在下方登记 id / 标题 / 加载器。
 */
export interface BuiltinDocument {
  id: string;
  title: string;
  /** 按需加载正文 HTML（独立分包，首次注入时才请求） */
  loadContent: () => Promise<string>;
}

export const BUILTIN_DOCUMENTS: BuiltinDocument[] = [
  {
    id: 'builtin-guokao-chengyu-v1',
    title: '国考言语·成语辨析与近五年考频大全',
    loadContent: () =>
      import('./builtin-guokao-chengyu.html?raw').then((m) => m.default),
  },
];
