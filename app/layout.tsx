import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '成都高新区教育资源地图',
  description: '成都高新区小学、初中和九年一贯制学校分布查询，支持学段、性质、区域筛选。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
