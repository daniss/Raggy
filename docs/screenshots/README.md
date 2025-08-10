# Screenshots Documentation

## Required Screenshots for README.md

The following screenshots need to be captured and placed in this directory:

### 1. `landing-page.png`
- **URL**: `http://localhost:3000`
- **Content**: Landing page with commercial presentation
- **Focus**: Hero section, features, pricing, demo button
- **Size**: 1200x800px recommended

### 2. `demo-interface.png`
- **URL**: `http://localhost:3000/demo`
- **Content**: Demo sandbox with pre-loaded corpus
- **Focus**: Chat interface, document list, suggested questions
- **Size**: 1200x800px recommended

### 3. `chat-assistant.png`
- **URL**: `http://localhost:3000/demo` (during a conversation)
- **Content**: Active conversation with AI assistant
- **Focus**: Streaming response, cited sources, clickable references
- **Size**: 1200x800px recommended

### 4. `document-upload.png`
- **URL**: `http://localhost:3000/demo` (upload modal open)
- **Content**: Document upload interface
- **Focus**: Drag & drop area, supported formats, processing status
- **Size**: 1200x800px recommended

## Capture Instructions

1. **Setup Environment**:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   python scripts/load_demo_corpus.py
   ```

2. **Browser Configuration**:
   - Use Chrome or Firefox
   - Set viewport to 1200x800
   - Ensure good lighting and contrast

3. **Sample Interaction for chat-assistant.png**:
   - Ask: "Quelles sont les obligations du responsable de traitement selon le RGPD ?"
   - Wait for complete response with sources
   - Capture with sources visible

4. **File Naming Convention**:
   - Use exact filenames as listed above
   - PNG format for best quality
   - Optimize file size (< 500KB each)

## Current Status

- [ ] landing-page.png
- [ ] demo-interface.png  
- [ ] chat-assistant.png
- [ ] document-upload.png

**Note**: Screenshots will be added by the development team during final documentation phase.