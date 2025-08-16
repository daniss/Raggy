"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Search, Settings, Send, Paperclip, MoreHorizontal, Copy, ExternalLink, StopCircle, ChevronDown, ChevronUp } from "lucide-react"
import { useApp } from "@/contexts/app-context"
import { ConversationsAPI, type Conversation, type Message } from "@/lib/api/conversations"
import { useChat, type ChatOptions } from "@/lib/hooks/use-chat"
import { useToast } from "@/hooks/use-toast"

// Minimal Whiteout Theme CSS Variables
const themeStyles = `
  :root {
    --mw-bg: #FAFAFA;
    --mw-surface: #FFFFFF;
    --mw-text-primary: #1E293B;
    --mw-text-muted: #64748B;
    --mw-accent: #FF6B6B;
    --mw-border: #E6EEF3;
    --mw-success: #16A34A;
    --mw-error: #E11D48;
    --mw-info: #0284C7;
    --mw-shadow: rgba(16,24,40,0.06);
    --mw-glass: rgba(255,255,255,0.6);
    --mw-accent-highlight: rgba(255,107,107,0.12);
  }
`

function MinimalChatInterface() {
  // State management
  const [message, setMessage] = useState("")
  const [activeConversation, setActiveConversation] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set())
  
  // Hooks
  const { organization } = useApp()
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)

  const chat = useChat({
    orgId: organization?.id || '',
    onError: (error) => {
      toast({
        title: "Error",
        description: error,
        variant: 'destructive'
      })
    },
    onSuccess: (assistantContent?: string) => {
      if (assistantContent) {
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          type: 'assistant',
          content: assistantContent,
          timestamp: new Date().toISOString(),
          metadata: chat.citations.length > 0 ? { citations: chat.citations } : undefined
        }
        setMessages(prev => [...prev, assistantMessage])
      }
      loadConversations()
    }
  })

  // Load conversations
  const loadConversations = async () => {
    if (!organization?.id) return
    
    try {
      setLoadingConversations(true)
      const response = await ConversationsAPI.getConversations(organization.id)
      setConversations(response.conversations)
      
      if (response.conversations.length > 0 && !activeConversation) {
        setActiveConversation(response.conversations[0].id)
      }
    } catch (error) {
      console.error('Failed to load conversations:', error)
    } finally {
      setLoadingConversations(false)
    }
  }

  // Load messages
  const loadMessages = async () => {
    if (!activeConversation) return
    
    try {
      setLoadingMessages(true)
      const msgs = await ConversationsAPI.getMessages(activeConversation)
      setMessages(msgs)
    } catch (error) {
      console.error('Failed to load messages:', error)
    } finally {
      setLoadingMessages(false)
    }
  }

  // Handle send message
  const handleSendMessage = async () => {
    if (!message.trim() || chat.isStreaming || !organization?.id) return

    const messageContent = message.trim()
    setMessage("")
    
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: messageContent,
      timestamp: new Date().toISOString()
    }
    setMessages(prev => [...prev, userMessage])
    
    const options: ChatOptions = {
      citations: true,
      fast_mode: false
    }
    
    try {
      const newConversationId = await chat.send(messageContent, options, activeConversation)
      
      if (newConversationId && !activeConversation) {
        setActiveConversation(newConversationId)
        loadConversations()
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      setMessages(prev => prev.filter(m => m.id !== userMessage.id))
    }
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const toggleSourceExpansion = (sourceId: string) => {
    setExpandedSources(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sourceId)) {
        newSet.delete(sourceId)
      } else {
        newSet.add(sourceId)
      }
      return newSet
    })
  }

  useEffect(() => {
    loadConversations()
  }, [organization?.id])

  useEffect(() => {
    if (activeConversation) {
      loadMessages()
    } else {
      setMessages([])
    }
  }, [activeConversation])

  return (
    <>
      <style>{themeStyles}</style>
      <div className="h-screen flex" style={{ backgroundColor: 'var(--mw-bg)', fontFamily: '"Neue Haas Grotesk", -apple-system, BlinkMacSystemFont, sans-serif' }}>
        
        {/* Header */}
        <header 
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 border-b"
          style={{ 
            height: '72px',
            backgroundColor: 'var(--mw-bg)',
            borderColor: 'var(--mw-border)'
          }}
        >
          <div className="flex items-center space-x-3">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--mw-surface)', border: '1px solid var(--mw-border)' }}
            >
              <div 
                className="w-4 h-4 rounded"
                style={{ backgroundColor: 'var(--mw-accent)' }}
              />
            </div>
            <div>
              <h1 
                className="text-xl font-semibold"
                style={{ 
                  color: 'var(--mw-text-primary)',
                  fontSize: '22px',
                  lineHeight: '30px',
                  fontWeight: '600',
                  letterSpacing: '-0.01em'
                }}
              >
                Assistant
              </h1>
              <p 
                className="text-sm"
                style={{ 
                  color: 'var(--mw-text-muted)',
                  fontSize: '14px',
                  lineHeight: '20px'
                }}
              >
                Clear, sourced answers
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              size="sm"
              className="p-2 rounded-lg hover:scale-[1.01] transition-all duration-120"
              style={{ 
                color: 'var(--mw-text-muted)',
                backgroundColor: 'transparent'
              }}
            >
              <Search className="w-5 h-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              className="p-2 rounded-lg hover:scale-[1.01] transition-all duration-120"
              style={{ 
                color: 'var(--mw-text-muted)',
                backgroundColor: 'transparent'
              }}
              onClick={() => setShowSettings(true)}
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </header>

        {/* Conversation List */}
        <aside 
          className="fixed left-0 top-[72px] bottom-0 w-80 border-r overflow-y-auto"
          style={{ 
            backgroundColor: 'var(--mw-surface)',
            borderColor: 'var(--mw-border)'
          }}
        >
          <div className="p-4">
            <Button 
              className="w-full justify-start rounded-xl font-medium transition-all duration-320"
              style={{ 
                backgroundColor: 'var(--mw-accent)',
                color: 'white',
                fontSize: '14px',
                height: '44px'
              }}
              onClick={() => {
                setActiveConversation(null)
                setMessages([])
              }}
            >
              New Conversation
            </Button>
          </div>
          
          <div className="px-2">
            {conversations.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div 
                  className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: 'var(--mw-bg)' }}
                >
                  <div 
                    className="w-8 h-8 rounded-full"
                    style={{ backgroundColor: 'var(--mw-text-muted)' }}
                  />
                </div>
                <h3 
                  className="font-semibold mb-2"
                  style={{ 
                    color: 'var(--mw-text-primary)',
                    fontSize: '16px',
                    lineHeight: '24px'
                  }}
                >
                  No conversations yet
                </h3>
                <p 
                  style={{ 
                    color: 'var(--mw-text-muted)',
                    fontSize: '14px',
                    lineHeight: '20px'
                  }}
                >
                  Start by asking a question
                </p>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className="relative group cursor-pointer rounded-xl p-3 mb-1 transition-all duration-320"
                  style={{
                    backgroundColor: activeConversation === conv.id ? 'var(--mw-bg)' : 'transparent',
                    borderLeft: activeConversation === conv.id ? '2px solid var(--mw-accent)' : '2px solid transparent'
                  }}
                  onClick={() => setActiveConversation(conv.id)}
                >
                  <h4 
                    className="font-medium truncate mb-1"
                    style={{ 
                      color: 'var(--mw-text-primary)',
                      fontSize: '14px',
                      lineHeight: '20px'
                    }}
                  >
                    {conv.title}
                  </h4>
                  <div className="flex items-center justify-between">
                    <p 
                      className="text-xs truncate"
                      style={{ 
                        color: 'var(--mw-text-muted)',
                        fontSize: '12px',
                        lineHeight: '16px'
                      }}
                    >
                      {conv.message_count} messages
                    </p>
                    <span 
                      className="text-xs"
                      style={{ 
                        color: 'var(--mw-text-muted)',
                        fontSize: '12px',
                        lineHeight: '16px'
                      }}
                    >
                      {formatTimestamp(conv.updated_at)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col ml-80">
          {/* Chat Thread */}
          <div className="flex-1 overflow-y-auto pt-[72px] pb-32">
            <div className="max-w-4xl mx-auto px-6 py-8">
              {messages.length === 0 && !chat.streamingMessage && (
                <div className="text-center py-20">
                  <div 
                    className="w-24 h-24 mx-auto mb-6 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: 'var(--mw-surface)', border: '1px solid var(--mw-border)' }}
                  >
                    <div 
                      className="w-12 h-12 rounded-xl"
                      style={{ backgroundColor: 'var(--mw-accent)', opacity: 0.1 }}
                    />
                  </div>
                  <h2 
                    className="text-2xl font-semibold mb-3"
                    style={{ 
                      color: 'var(--mw-text-primary)',
                      fontSize: '28px',
                      lineHeight: '36px',
                      fontWeight: '600'
                    }}
                  >
                    Ask anything
                  </h2>
                  <p 
                    style={{ 
                      color: 'var(--mw-text-muted)',
                      fontSize: '16px',
                      lineHeight: '24px',
                      maxWidth: '480px',
                      margin: '0 auto'
                    }}
                  >
                    Get clear, sourced answers from your documents. Perfect for research, analysis, and decision-making.
                  </p>
                </div>
              )}

              <div className="space-y-4">
                {/* Regular Messages */}
                {messages.map((msg) => (
                  <div 
                    key={msg.id}
                    className="animate-in slide-in-from-bottom-2 fade-in duration-320"
                    style={{ animationFillMode: 'both' }}
                  >
                    {msg.type === 'user' ? (
                      <div className="flex justify-end mb-4">
                        <div 
                          className="max-w-[78%] rounded-xl px-4 py-3"
                          style={{ 
                            backgroundColor: 'var(--mw-surface)',
                            border: '1px solid var(--mw-border)',
                            boxShadow: '0 6px 18px var(--mw-shadow)'
                          }}
                        >
                          <p 
                            style={{ 
                              color: 'var(--mw-text-primary)',
                              fontSize: '16px',
                              lineHeight: '24px',
                              fontWeight: '500'
                            }}
                          >
                            {msg.content}
                          </p>
                          <div className="flex justify-end mt-2">
                            <span 
                              style={{ 
                                color: 'var(--mw-text-muted)',
                                fontSize: '12px',
                                lineHeight: '16px'
                              }}
                            >
                              {formatTimestamp(msg.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-start mb-4">
                        <div className="max-w-[78%]">
                          <div className="flex items-start space-x-3">
                            <div 
                              className="w-1 h-1 rounded-full mt-6 flex-shrink-0"
                              style={{ backgroundColor: 'var(--mw-accent)' }}
                            />
                            <div 
                              className="flex-1 rounded-xl px-4 py-3"
                              style={{ 
                                backgroundColor: 'var(--mw-surface)',
                                border: '1px solid var(--mw-border)',
                                boxShadow: '0 6px 18px var(--mw-shadow)'
                              }}
                            >
                              <p 
                                style={{ 
                                  color: 'var(--mw-text-primary)',
                                  fontSize: '16px',
                                  lineHeight: '24px'
                                }}
                              >
                                {msg.content}
                              </p>
                              
                              {/* Sources */}
                              {msg.metadata?.citations && msg.metadata.citations.length > 0 && (
                                <div className="mt-4 space-y-2">
                                  {msg.metadata.citations.map((citation: any, idx: number) => (
                                    <div 
                                      key={idx}
                                      className="rounded-lg border p-3 transition-all duration-240"
                                      style={{ 
                                        backgroundColor: 'var(--mw-bg)',
                                        borderColor: 'var(--mw-border)'
                                      }}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                          <h4 
                                            className="font-medium truncate"
                                            style={{ 
                                              color: 'var(--mw-text-primary)',
                                              fontSize: '14px',
                                              lineHeight: '20px'
                                            }}
                                          >
                                            {citation.document_title || citation.document_filename || 'Document'}
                                          </h4>
                                          <div className="flex items-center space-x-2 mt-1">
                                            <span 
                                              className="px-2 py-1 rounded text-xs border"
                                              style={{ 
                                                color: 'var(--mw-text-muted)',
                                                backgroundColor: 'var(--mw-surface)',
                                                borderColor: 'var(--mw-border)',
                                                fontSize: '12px'
                                              }}
                                            >
                                              {Math.round(citation.score * 100)}% confidence
                                            </span>
                                          </div>
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="p-1 hover:scale-[1.01] transition-all duration-120"
                                          onClick={() => toggleSourceExpansion(`${msg.id}-${idx}`)}
                                        >
                                          {expandedSources.has(`${msg.id}-${idx}`) ? (
                                            <ChevronUp className="w-4 h-4" style={{ color: 'var(--mw-text-muted)' }} />
                                          ) : (
                                            <ChevronDown className="w-4 h-4" style={{ color: 'var(--mw-text-muted)' }} />
                                          )}
                                        </Button>
                                      </div>
                                      
                                      {expandedSources.has(`${msg.id}-${idx}`) && (
                                        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--mw-border)' }}>
                                          <p 
                                            style={{ 
                                              color: 'var(--mw-text-muted)',
                                              fontSize: '14px',
                                              lineHeight: '20px'
                                            }}
                                          >
                                            Source content excerpt would appear here...
                                          </p>
                                          <div className="flex space-x-2 mt-3">
                                            <Button 
                                              variant="ghost" 
                                              size="sm"
                                              className="text-xs px-3 py-1 rounded-lg hover:scale-[1.01] transition-all duration-120"
                                              style={{ color: 'var(--mw-accent)' }}
                                            >
                                              <ExternalLink className="w-3 h-3 mr-1" />
                                              Open source
                                            </Button>
                                            <Button 
                                              variant="ghost" 
                                              size="sm"
                                              className="text-xs px-3 py-1 rounded-lg hover:scale-[1.01] transition-all duration-120"
                                              style={{ color: 'var(--mw-text-muted)' }}
                                            >
                                              <Copy className="w-3 h-3 mr-1" />
                                              Cite
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              <div className="flex items-center justify-between mt-3">
                                <span 
                                  style={{ 
                                    color: 'var(--mw-text-muted)',
                                    fontSize: '12px',
                                    lineHeight: '16px'
                                  }}
                                >
                                  {formatTimestamp(msg.timestamp)}
                                </span>
                                <div className="flex space-x-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="p-1 rounded hover:scale-[1.01] transition-all duration-120"
                                    style={{ color: 'var(--mw-text-muted)' }}
                                  >
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="p-1 rounded hover:scale-[1.01] transition-all duration-120"
                                    style={{ color: 'var(--mw-text-muted)' }}
                                  >
                                    <MoreHorizontal className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Streaming Message */}
                {chat.streamingMessage && (
                  <div className="animate-in slide-in-from-bottom-2 fade-in duration-320">
                    <div className="flex justify-start mb-4">
                      <div className="max-w-[78%]">
                        <div className="flex items-start space-x-3">
                          <div 
                            className="w-1 h-1 rounded-full mt-6 flex-shrink-0 animate-pulse"
                            style={{ backgroundColor: 'var(--mw-accent)' }}
                          />
                          <div 
                            className="flex-1 rounded-xl px-4 py-3"
                            style={{ 
                              backgroundColor: 'var(--mw-surface)',
                              border: '1px solid var(--mw-border)',
                              boxShadow: '0 6px 18px var(--mw-shadow)'
                            }}
                          >
                            <p 
                              style={{ 
                                color: 'var(--mw-text-primary)',
                                fontSize: '16px',
                                lineHeight: '24px'
                              }}
                            >
                              {chat.streamingMessage.content}
                              <span className="animate-pulse">|</span>
                            </p>
                            
                            <div className="flex items-center justify-between mt-3">
                              <span 
                                style={{ 
                                  color: 'var(--mw-text-muted)',
                                  fontSize: '12px',
                                  lineHeight: '16px'
                                }}
                              >
                                Generating...
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="px-2 py-1 text-xs rounded hover:scale-[1.01] transition-all duration-120"
                                style={{ color: 'var(--mw-text-muted)' }}
                                onClick={chat.stop}
                              >
                                <StopCircle className="w-3 h-3 mr-1" />
                                Stop
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Input Composer */}
          <div 
            className="fixed bottom-0 right-0 left-80 border-t"
            style={{ 
              backgroundColor: 'var(--mw-surface)',
              borderColor: 'var(--mw-border)'
            }}
          >
            <div className="max-w-4xl mx-auto p-6">
              <div className="flex items-end space-x-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-3 rounded-xl hover:scale-[1.01] transition-all duration-120"
                  style={{ 
                    color: 'var(--mw-text-muted)',
                    border: '1px solid var(--mw-border)'
                  }}
                >
                  <Paperclip className="w-5 h-5" />
                </Button>
                
                <div className="flex-1 relative">
                  <Input
                    ref={inputRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Ask anything — clear, sourced answers."
                    className="w-full rounded-xl border px-4 py-3 text-base resize-none focus:ring-2 transition-all duration-120"
                    style={{ 
                      backgroundColor: 'var(--mw-surface)',
                      borderColor: 'var(--mw-border)',
                      color: 'var(--mw-text-primary)',
                      fontSize: '14px',
                      minHeight: '48px'
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                    disabled={chat.isStreaming}
                  />
                </div>
                
                <Button
                  onClick={handleSendMessage}
                  disabled={!message.trim() || chat.isStreaming}
                  className="px-6 py-3 rounded-xl font-medium hover:scale-[1.01] transition-all duration-120 disabled:opacity-50"
                  style={{ 
                    backgroundColor: 'var(--mw-accent)',
                    color: 'white',
                    height: '48px'
                  }}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              
              {/* Disclaimer */}
              <div className="mt-3 text-center">
                <p 
                  style={{ 
                    color: 'var(--mw-text-muted)',
                    fontSize: '12px',
                    lineHeight: '16px'
                  }}
                >
                  This answer includes retrieved content. Verify before relying in critical cases.
                </p>
              </div>
            </div>
          </div>
        </main>

        {/* Settings Modal */}
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent 
            className="max-w-md rounded-2xl"
            style={{ 
              backgroundColor: 'var(--mw-surface)',
              border: '1px solid var(--mw-border)',
              boxShadow: '0 20px 25px -5px var(--mw-shadow)'
            }}
          >
            <DialogHeader>
              <DialogTitle 
                style={{ 
                  color: 'var(--mw-text-primary)',
                  fontSize: '22px',
                  lineHeight: '30px',
                  fontWeight: '600'
                }}
              >
                Settings
              </DialogTitle>
              <DialogDescription 
                style={{ 
                  color: 'var(--mw-text-muted)',
                  fontSize: '14px',
                  lineHeight: '20px'
                }}
              >
                Customize your assistant experience
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label 
                  className="text-sm font-medium"
                  style={{ 
                    color: 'var(--mw-text-primary)',
                    fontSize: '14px',
                    lineHeight: '20px'
                  }}
                >
                  Response Style
                </label>
                <select 
                  className="w-full rounded-lg border px-3 py-2"
                  style={{ 
                    backgroundColor: 'var(--mw-surface)',
                    borderColor: 'var(--mw-border)',
                    color: 'var(--mw-text-primary)'
                  }}
                >
                  <option>Detailed</option>
                  <option>Concise</option>
                  <option>Technical</option>
                </select>
              </div>
            </div>
            
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setShowSettings(false)}
                className="rounded-lg"
                style={{ 
                  borderColor: 'var(--mw-border)',
                  color: 'var(--mw-text-muted)'
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={() => setShowSettings(false)}
                className="rounded-lg"
                style={{ 
                  backgroundColor: 'var(--mw-accent)',
                  color: 'white'
                }}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}

export default function AssistantPage() {
  return <MinimalChatInterface />
}
