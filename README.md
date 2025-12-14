# File Processing Toolkit

A browser-based file processing toolkit with 3 standalone tools for image compression, PDF conversion, and audio trimming.

## Features

### 🖼️ Image Compressor & Resizer

- Drag-and-drop or click to upload multiple images
- Real-time quality adjustment (1-100%)
- Resize with aspect ratio locking
- Batch processing support
- Live file size preview
- Supports JPG, PNG, WebP

### 📄 PDF to Image Converter

- Upload PDF files and convert pages to images
- Select individual pages or all page
- Batch export as ZIP file
- Visual page selection interface

### 🎵 Audio Trimmer

- Interactive waveform visualization
- Drag handles to set trim points
- Real-time audio preview
- Export trimmed audio as WAV
- Supports MP3, WAV, OGG, M4A

## Global Features

- ✅ **Drag & Drop**: All tools support drag-and-drop file upload with visual feedback
- ✅ **File Validation**: Validates file type and enforces 10MB limit
- ✅ **Processing Feedback**: Progress indicators and loading states
- ✅ **Responsive Design**: Works on desktop and tablet
- ✅ **No Backend**: 100% client-side, no server uploads
- ✅ **Error Handling**: Comprehensive error boundaries and user-friendly messages
- ✅ **Memory Management**: Automatic cleanup of object URLs and resources

## Tech Stack

- **Framework**: Next.js 16 with React 19
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS
- **Audio Processing**: WaveSurfer.js
- **PDF Processing**: pdfjs-dist
- **Image Processing**: Canvas API
- **ZIP Creation**: JSZip
- **Notifications**: Sonner

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)

### Installation

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Architecture

### Component Structure

```
app/
├── error.tsx               # Next.js error boundary for route-level error handling
├── page.tsx               # Main page with tool tabs
└── layout.tsx             # Root layout with toast provider

components/
├── FileUpload.tsx         # Reusable drag-and-drop file upload component
└── tools/
    ├── ImageCompressor.tsx # Image compression and resizing tool
    ├── PDFConverter.tsx    # PDF to image conversion tool
    └── AudioTrimmer.tsx    # Audio trimming with waveform visualization

lib/
└── file-utils.ts          # File validation, formatting, and cleanup utilities
```

### Key Design Decisions

1. **Reusable Components**: FileUpload component is shared across all tools with consistent validation and UX
2. **Memory Management**: All object URLs are properly cleaned up to prevent memory leaks
3. **Error Handling**: Uses Next.js error boundaries error.tsx for route-level error handling per
4. **Client-Side Only**: All processing happens in the browser using Web APIs (Canvas, Web Audio API, etc.)
5. **Performance**: Large files are processed efficiently without blocking the UI

### File Processing Flow

1. **Upload**: Files are validated (type, size) via `FileUpload` component
2. **Processing**: Tools use browser APIs to process files:
   - Images: Canvas API for compression/resizing
   - PDFs: pdfjs-dist for rendering pages to canvas
   - Audio: Web Audio API + WaveSurfer.js for trimming
3. **Export**: Processed files are downloaded directly to user's device
4. **Cleanup**: Object URLs and resources are automatically cleaned up

## Performance Considerations

- **Large Files**: Processing happens asynchronously to avoid UI freezing
- **Memory Cleanup**: Object URLs are revoked after use
- **Batch Processing**: Images are processed sequentially with progress feedback
- **Web Workers**: Can be added for heavy computations (future enhancement)

## Limitations

- Maximum file size: 10MB per file, in the future could allow bigger files
- PDF rendering requires internet connection for worker (CDN)
- Audio trimming exports as WAV (lossless, larger file size)
