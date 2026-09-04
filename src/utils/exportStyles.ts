/**
 * 导出样式：独立 HTML 文件与 PDF 离屏渲染共用的阅读样式。
 * 以 index.css 中 .recite-document-content 规则为蓝本，做导出场景适配：
 * - 标题 div.title 显示（居中、加粗），阅读页中标题由顶栏展示故隐藏；
 * - 剔除折叠交互与重点隐藏（recite-highlight-*）相关规则，导出内容全部可见。
 */
export const EXPORT_CSS = `
body {
  margin: 0;
  padding: 24px;
  background: #F9F7F2;
}
.recite-document-content {
  font-family: "Noto Serif SC", Georgia, serif;
  line-height: 1.8;
  color: #1A202C;
  max-width: 800px;
  margin: 0 auto;
}
.recite-document-content ul.node-list,
.recite-document-content ol.node-list {
  margin: 0;
  padding-left: 18px;
  list-style: none;
}
.recite-document-content ul.node-list ul.node-list,
.recite-document-content ul.node-list ol.node-list,
.recite-document-content ol.node-list ul.node-list,
.recite-document-content ol.node-list ol.node-list {
  padding-left: 16px;
}
.recite-document-content li.node {
  position: relative;
  margin: 0.35rem 0;
}
.recite-document-content li.node > .bullet {
  position: absolute;
  left: -12px;
  top: 0.9em;
  transform: translateY(-50%);
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background-color: #a8906c;
}
.recite-document-content li.node > .bullet > .bullet-dot {
  display: none;
}
.recite-document-content li.node:has(> .children) > .bullet {
  width: 8px;
  height: 8px;
  background-color: #8a7a57;
}
.recite-document-content .content.mm-editor {
  display: block;
}
.recite-document-content div.title {
  display: block;
  text-align: center;
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 1em;
}
.recite-document-content ul.node-list > li.node > .content {
  font-size: 1.15em;
}
.recite-document-content li.node .children ul.node-list > li.node > .content {
  font-size: 1em;
}
.recite-document-content ul.node-list > li.node::after {
  content: "";
  position: absolute;
  left: -9px;
  top: 1rem;
  bottom: 0.25rem;
  width: 1px;
  transform: translateX(-0.5px);
  background: linear-gradient(rgba(168, 144, 108, 0.5), rgba(168, 144, 108, 0.1));
  pointer-events: none;
}
.recite-document-content li.node .children ul.node-list > li.node::after {
  display: none;
}
.recite-document-content li.node > .note.mm-editor {
  font-size: 0.85em;
  color: #757575;
  line-height: 1.6;
  margin-top: 0.3em;
}
.recite-document-content .underline {
  text-decoration: underline;
  text-underline-offset: 4px;
  text-decoration-thickness: 2px;
  text-decoration-color: #D97706;
  background-color: rgba(254, 243, 199, 0.4);
  border-radius: 2px;
  padding: 0 2px;
}
.recite-document-content h1,
.recite-document-content h2,
.recite-document-content h3,
.recite-document-content h4 {
  font-family: "Noto Sans SC", system-ui, sans-serif;
  font-weight: 600;
  color: #1A202C;
  margin-top: 1.5em;
  margin-bottom: 0.75em;
  font-size: 1.6rem;
}
.recite-document-content h2 {
  font-size: 1.4rem;
}
.recite-document-content h3 {
  font-size: 1.25rem;
}
.recite-document-content h4 {
  font-size: 1.15rem;
}
.recite-document-content p {
  margin-bottom: 1.25em;
}
.recite-document-content img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 1.5em 0;
}
.recite-document-content table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.5em 0;
}
.recite-document-content th,
.recite-document-content td {
  border: 1px solid #E7E5E4;
  padding: 0.5em 0.75em;
  text-align: left;
}
.recite-document-content th {
  background-color: #FAFAF9;
}
`.trim();
