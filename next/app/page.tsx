"use client";

import { useEffect, useRef, useState } from "react";

type ConvertResponse = {
  success: boolean;
  html?: string;
  style?: string;
  customCss?: string;
  theme?: string;
  error?: string;
};

type ThemesResponse = {
  success: boolean;
  themes: string[];
  defaultTheme: string | null;
  error?: string;
};

export default function HomePage() {
  const [markdown, setMarkdown] = useState<string>(
    [
      "# Markdown转公众号格式",
      "",
      "这是一个**示例**文档，展示Markdown转换为公众号格式的效果。",
      "",
      "## 功能特点",
      "",
      "- 实时预览",
      "- 主题配置",
      "- 样式美化",
      "",
      "### 代码示例",
      "",
      "```python",
      "def hello():",
      '    print("Hello, World!")',
      "```",
      "",
      "> 这是一个引用块",
      "",
      "**粗体文本** 和 *斜体文本*",
    ].join("\n")
  );
  const [previewHtml, setPreviewHtml] = useState<string>('<div class="loading">等待输入...</div>');
  const [themes, setThemes] = useState<string[]>([]);
  const [currentTheme, setCurrentTheme] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorPanelRef = useRef<HTMLDivElement | null>(null);
  const previewPanelRef = useRef<HTMLDivElement | null>(null);
  const isResizingRef = useRef(false);

  // 加载主题列表
  useEffect(() => {
    const loadThemes = async () => {
      try {
        const res = await fetch("/api/themes");
        const data = (await res.json()) as ThemesResponse;
        if (!data.success) {
          console.error("加载主题失败:", data.error);
          return;
        }
        setThemes(data.themes || []);
        const defaultTheme = data.defaultTheme || data.themes[0] || null;
        setCurrentTheme(defaultTheme);
        // 首次加载完成后触发一次转换
        void convertMarkdown(markdown, defaultTheme);
      } catch (e: any) {
        console.error("加载主题异常:", e);
      }
    };

    void loadThemes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 输入防抖转换
  useEffect(() => {
    if (!markdown.trim()) {
      setPreviewHtml('<div class="loading">等待输入...</div>');
      return;
    }
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      void convertMarkdown(markdown, currentTheme);
    }, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markdown, currentTheme]);

  async function convertMarkdown(text: string, theme: string | null) {
    if (!text.trim()) {
      setPreviewHtml('<div class=\"loading\">等待输入...</div>');
      return;
    }
    setLoading(true);
    setError(null);
    setPreviewHtml('<div class="loading">转换中...</div>');
    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markdown: text,
          theme: theme,
        }),
      });
      const data = (await res.json()) as ConvertResponse;
      if (!data.success || !data.html) {
        setError(data.error || "转换失败");
        setPreviewHtml(`<div class="error">错误: ${data.error || "转换失败"}</div>`);
      } else {
        setPreviewHtml(data.html);
      }
    } catch (e: any) {
      setError(e.message || String(e));
      setPreviewHtml(`<div class="error">网络错误: ${e.message}</div>`);
    } finally {
      setLoading(false);
    }
  }

  // 一键复制预览 HTML
  async function handleCopyHtml() {
    const textContent = previewHtml.replace(/<[^>]+>/g, "").trim();
    if (!previewHtml || textContent === "等待输入..." || textContent === "转换中...") {
      alert("当前没有可复制的内容");
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(previewHtml);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = previewHtml;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      alert("已复制当前预览HTML到剪贴板，可直接粘贴到公众号编辑器中。");
    } catch (e) {
      console.error(e);
      alert("复制失败，请手动全选预览内容复制。");
    }
  }

  // 拖拽调整左右宽度
  function handleMouseDown() {
    isResizingRef.current = true;
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isResizingRef.current) return;
    const container = containerRef.current;
    const editorPanel = editorPanelRef.current;
    const previewPanel = previewPanelRef.current;
    if (!container || !editorPanel || !previewPanel) return;

    const rect = container.getBoundingClientRect();
    const newLeftWidth = ((e.clientX - rect.left) / rect.width) * 100;
    if (newLeftWidth > 20 && newLeftWidth < 80) {
      editorPanel.style.flex = `0 0 ${newLeftWidth}%`;
      previewPanel.style.flex = `0 0 ${100 - newLeftWidth}%`;
    }
  }

  function handleMouseUp() {
    isResizingRef.current = false;
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  }

  return (
    <div className="container" ref={containerRef}>
      <div className="editor-panel" ref={editorPanelRef}>
        <div className="panel-header">
          <div className="panel-title">Markdown 编辑器</div>
        </div>
        <div className="editor-container">
          <textarea
            className="markdown-input"
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            placeholder="在此输入Markdown内容..."
          />
        </div>
      </div>

      <div
        className="divider"
        onMouseDown={handleMouseDown}
        aria-hidden="true"
      />

      <div className="preview-panel" ref={previewPanelRef}>
        <div className="panel-header">
          <div className="panel-title">预览效果</div>
          <div className="panel-actions">
            <select
              className="theme-select"
              value={currentTheme ?? ""}
              onChange={(e) => setCurrentTheme(e.target.value || null)}
            >
              {!themes.length && (
                <option value="">未找到主题，请先抓取 theme/</option>
              )}
              {themes.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-copy"
              onClick={handleCopyHtml}
              disabled={loading}
            >
              一键复制HTML
            </button>
          </div>
        </div>
        <div className="preview-container">
          <div
            id="preview"
            className="preview-content"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      </div>
    </div>
  );
}


