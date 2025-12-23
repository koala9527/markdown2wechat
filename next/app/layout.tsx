import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Markdown 转公众号格式",
  description: "基于 Next.js 的 Markdown 转 mdnice/公众号排版预览工具",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}


