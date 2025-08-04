# Assistant IA - RAG Chat Interface

## Overview
A modern, production-ready chat interface for the Raggy SaaS platform that provides authenticated users with an AI assistant powered by their organization's documents.

## Features

### 🔐 Authentication & Multi-tenancy
- Protected route requiring Supabase authentication
- Organization-scoped data access
- Automatic user context loading

### 💬 Chat Interface
- Real-time streaming responses with loading animations
- Markdown rendering for rich content
- Message history management
- Error handling with retry functionality
- Source citations for transparency

### 📄 Document Management
- Sidebar showing organization documents
- Document selection for contextual queries
- Search and filter functionality
- File metadata display (size, chunks, upload date)
- Collapsible sidebar for more chat space

### 📱 Responsive Design
- Mobile-friendly with toggleable document drawer
- Desktop layout with persistent sidebar
- Adaptive input area with auto-resize
- Smooth animations and transitions

### 🎨 Modern UI/UX
- Clean, minimalistic design inspired by Linear/Notion
- Consistent with admin panel styling
- Loading states and error boundaries
- Example questions for onboarding
- Professional typography and spacing

## Components Structure

```
/assistant
├── layout.tsx                 # Protected layout with navigation
├── page.tsx                   # Main chat interface
└── components/
    ├── DocumentSidebar.tsx    # Document list and selection
    ├── ChatMessage.tsx        # Message rendering with markdown
    ├── ChatInput.tsx          # Auto-resizing input area
    └── SourceCard.tsx         # Source citation display
```

## Technical Stack
- **Framework**: Next.js 14 with TypeScript
- **Auth**: Supabase Auth with organization context
- **Styling**: TailwindCSS + shadcn/ui components
- **Animations**: Framer Motion
- **API**: FastAPI backend with RAG pipeline
- **State**: React hooks with local state management

## Usage

The assistant is accessible at `/assistant` for authenticated users. It automatically:
1. Loads the user's organization context
2. Fetches available documents
3. Provides a chat interface for document queries
4. Maintains conversation history
5. Shows source citations for AI responses

## Future Enhancements
- Voice input/output
- File upload from chat
- Conversation persistence
- Advanced search filters
- Export chat history
- Multi-language support