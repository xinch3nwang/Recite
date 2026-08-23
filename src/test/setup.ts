import '@testing-library/jest-dom';
import { beforeEach } from 'vitest';

// 测试前清空 localStorage，保证用例间隔离
beforeEach(() => {
  localStorage.clear();
});
