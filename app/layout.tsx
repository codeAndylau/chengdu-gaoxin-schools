import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '成都高新区教育资源地图',
  description: '成都高新区小学、初中周边查询，支持地点半径、学段、性质和街道筛选。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
