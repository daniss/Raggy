"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CodeBlockProps {
  children: string
  language?: string
  className?: string
}

export function CodeBlock({ children, language, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group rounded-lg bg-slate-900 dark:bg-slate-800 overflow-hidden">
      {/* Header with language and copy button */}
      {(language || true) && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-slate-800 dark:bg-slate-700">
          <span className="text-xs font-medium text-slate-300">
            {language || 'code'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-6 w-6 p-0 text-slate-400 hover:text-slate-200 hover:bg-slate-700"
          >
            {copied ? (
              <Check className="w-3 h-3" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </Button>
        </div>
      )}
      
      {/* Code content */}
      <pre className="p-4 overflow-x-auto text-sm">
        <code className={`text-slate-100 ${className}`}>
          {children}
        </code>
      </pre>
    </div>
  )
}

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  // Simple markdown parsing - in a real app you'd use a proper markdown library
  const renderContent = (text: string) => {
    const lines = text.split('\n')
    const result: React.ReactNode[] = []
    let i = 0

    while (i < lines.length) {
      const line = lines[i]

      // Code blocks (```language)
      if (line.trim().startsWith('```')) {
        const language = line.trim().slice(3).trim()
        const codeLines: string[] = []
        i++
        
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i])
          i++
        }
        
        result.push(
          <CodeBlock key={i} language={language}>
            {codeLines.join('\n')}
          </CodeBlock>
        )
        i++
        continue
      }

      // Headers
      if (line.startsWith('# ')) {
        result.push(
          <h1 key={i} className="text-2xl font-bold mb-4 mt-6">
            {line.slice(2)}
          </h1>
        )
      } else if (line.startsWith('## ')) {
        result.push(
          <h2 key={i} className="text-xl font-semibold mb-3 mt-5">
            {line.slice(3)}
          </h2>
        )
      } else if (line.startsWith('### ')) {
        result.push(
          <h3 key={i} className="text-lg font-medium mb-2 mt-4">
            {line.slice(4)}
          </h3>
        )
      }
      // Blockquotes
      else if (line.startsWith('> ')) {
        result.push(
          <blockquote key={i} className="border-l-4 border-accent/30 pl-4 py-2 bg-surface-elevated rounded-r-lg my-3">
            <p className="text-text-subtle italic">{line.slice(2)}</p>
          </blockquote>
        )
      }
      // Lists
      else if (line.trim().match(/^[\*\-\+]\s/)) {
        result.push(
          <li key={i} className="ml-4 mb-1 list-disc">
            {line.trim().slice(2)}
          </li>
        )
      }
      // Inline code
      else if (line.includes('`')) {
        const parts = line.split('`')
        const rendered = parts.map((part, idx) => 
          idx % 2 === 0 ? part : (
            <code key={idx} className="bg-surface-elevated px-1.5 py-0.5 rounded text-sm font-mono">
              {part}
            </code>
          )
        )
        result.push(
          <p key={i} className="mb-3 leading-relaxed">
            {rendered}
          </p>
        )
      }
      // Regular paragraphs
      else if (line.trim()) {
        result.push(
          <p key={i} className="mb-3 leading-relaxed">
            {line}
          </p>
        )
      }
      // Empty lines
      else {
        result.push(<br key={i} />)
      }

      i++
    }

    return result
  }

  return (
    <div className={`prose prose-slate max-w-none ${className}`}>
      {renderContent(content)}
    </div>
  )
}