# Feature: Video Agent — Core Flow

> Every screen must read as the same product if placed side by side.

## Flow: Create and Render Video

### Overview

**Goal:** Assemble uploaded media and AI-generated segments into a professional templated video, then download or embed it.

**User Story:** As a network/security professional, I want to upload project screenshots and videos, add AI-generated title cards, and produce a polished video presentation without video editing software.

**Trigger:** User opens the app at `/` or navigates to the main page.

### Entry Points

- [x] Direct URL `/` — fresh session, empty state
- [x] Return visit — previous files cleared (session-scoped), settings preserved in form defaults

### Prerequisites

Before starting this flow, user must:
- [x] Have a modern browser (Chrome 90+, Firefox 90+, Safari 15+, Edge 90+)
- [x] Have media files ready (images or videos)
- [x] Server must be running with ffmpeg available

### Flow Diagram

```
[Start: Empty State]
    │
    ▼
┌─────────────────────┐
│  STEP 1: UPLOAD      │
│  Dropzone / File     │
│  picker / AI step    │
└─────────────────────┘
    │ files added
    ▼
┌─────────────────────┐
│  STEP 2: CONFIGURE   │
│  Title, subtitle,    │
│  aspect ratio, CTA   │
└─────────────────────┘
    │ settings ready
    ▼
┌─────────────────────┐
│  STEP 3: RENDER      │
│  POST /api/render    │
│  Poll /api/status    │
└─────────────────────┘
    │
    ├── done ──▶ [Result: Video + Download + Embed]
    │
    └── error ──▶ [Error State: Retry]
```

### Steps

#### Step 1: Upload Media

**Screen/Component:** UploadPanel with Dropzone

**User Action:**
- Drag files onto the dropzone, OR
- Click "Choose Files" button to open file picker, OR
- Click "+ Add AI Step" to add an AI-generated segment

**System Response:**
- Files appear in the file list below the dropzone
- Each file shows: thumbnail (image) or icon (video), filename, file size, type badge
- File count updates in the panel header
- Step pill advances to "Configure" (step 2)

**Data:**
- Input: image files (JPG, PNG, WebP, max 300MB each) or video files (MP4, MOV, WebM, max 300MB)
- Output: `items[]` array with `{ file, type, text, duration }` or `{ kind: "ai", aiPrompt, duration }`

**Transitions:**
- Files added → Update file list, advance step indicator
- AI step added → Show AI prompt section with gradient background
- Empty drop → No change (toast: "Please add at least one file")

**Validation:**
- File type: only image/* and video/* accepted
- File size: ≤ 300MB per file (server limit)
- Duplicate files: allowed (user may want the same image twice with different text)

---

#### Step 2: Configure Template

**Screen/Component:** SettingsPanel with form fields

**User Action:**
- Edit project title (default: "NETWORK SECURITY BRIEF")
- Edit subtitle (default: "SECURE // ANALYZE // DEFEND")
- Select aspect ratio from dropdown (16:9, 9:16, 1:1)
- Edit CTA text (default: "www.yourproject.com")

**System Response:**
- Form fields accept input immediately
- No validation errors on this step (all fields optional with defaults)

**Data:**
- Input: user text
- Output: `options` object with `{ aspect, projectTitle, subtitle, cta }`

**Transitions:**
- User edits fields → Values stored in form state
- User proceeds to Step 3 → Values sent with render request

---

#### Step 3: Render Video

**Screen/Component:** RenderPanel with button, progress bar, status area

**User Action:**
- Click "Render Video" button

**System Response:**
1. Button shows spinner + "Rendering..." text, becomes disabled
2. Progress bar appears at 10%
3. Status: "Uploading files..."
4. POST /api/render with FormData (files + timeline JSON + options JSON)
5. Server returns `{ jobId }`
6. Progress bar advances to 50%
7. Status: "Rendering video... This may take a few minutes"
8. Poll GET /api/status/:jobId every 2 seconds
9. On "done": progress → 100%, status → green "Video created successfully!"
10. Result area appears with video player + download button + embed code

**Data:**
- Input: files + timeline + options
- Output: `{ jobId }` → polling → `{ status: "done", file: "uuid.mp4" }`

**Transitions:**
- Rendering → Progress updates every 2s
- Done → Show video preview, download button, embed code
- Error → Show error message with retry option

---

### Decision Points

#### Decision: AI Step or File Upload?

**Condition:** User clicks "+ Add AI Step" vs. drops/clicks files

**Branch A: AI Step**
- Shows AI prompt input with gradient background (purple → cyan)
- User types a description of the scene AI should generate
- Duration field defaults to 3 seconds
- Added to timeline as `{ type: "ai", aiPrompt: "...", duration: 3 }`

**Branch B: File Upload**
- Files added to the list with thumbnails
- User can add text overlay per file
- User can set duration per file (images default to 4s, videos use original)
- Added to timeline as `{ type: "image"|"video", fileIndex: N, text: "...", duration: N }`

---

### Exit Points

#### Success Exit
- **Condition:** Render completes without error
- **Destination:** Result area appears in the same page (scroll to it)
- **Feedback:** Green status bar "Video created successfully!"
- **Side effects:** Video file stored in `/output/{jobId}.mp4`

#### Error Exit
- **Condition:** Render fails (ffmpeg error, file too large, server error)
- **Feedback:** Red status bar with error message
- **Recovery:** User can modify inputs and click "Render Video" again

---

### Error Handling

| Error Type | Trigger | User Message | Recovery Action |
|------------|---------|--------------|-----------------|
| No files | Render with empty list | "Please add at least one file" (toast) | Add files |
| File too large | > 300MB upload | Server returns error | Use smaller files |
| ffmpeg missing | Server can't find ffmpeg | "Video rendering failed: ffmpeg not found" | Install ffmpeg |
| Network error | POST fails | "Upload failed. Check your connection." | Retry |
| Render timeout | Job takes too long | "Rendering is taking longer than expected" | Wait or retry |
| Server crash | 500 response | "Server error. Please try again." | Retry |

### Edge Cases

| Scenario | Handling |
|----------|----------|
| User refreshes mid-render | Job is lost (in-memory store). User must restart from Step 1. |
| User closes tab during render | Server continues rendering. File available at `/output/{jobId}.mp4` if jobId is known. |
| Slow connection | Progress bar shows upload phase. Large files may take time. |
| Multiple renders | Previous render result is replaced. Only latest result shown. |
| Empty AI prompt | AI step is skipped (not added to timeline). |
| Very long video input | ffprobe detects duration. User can set trim duration. |

### State Requirements

**URL State:** None (single-page app, no deep linking needed)

**Component State:**
```javascript
{
  items: [],           // uploaded files + AI steps
  currentStep: 1,      // 1=upload, 2=configure, 3=render
  isRendering: false,   // render in progress
  jobId: null,          // current render job
  resultUrl: null,      // completed video URL
}
```

---

## Component Specs

### Component: Dropzone

**Purpose:** Accept file uploads via drag-and-drop or click-to-browse.

**Props:**
```typescript
interface DropzoneProps {
  onFilesAdded: (files: File[]) => void;
  accept?: string;  // default: "image/*,video/*"
  disabled?: boolean;
}
```

**States:**
| State | Visual | Behavior |
|-------|--------|----------|
| Default | Dashed border, cloud icon, "Choose Files" button | Click opens file picker |
| Dragover | Border turns accent (cyan), slight scale(1.01) | Ready to accept drop |
| Active (file selected) | Same as default | Files processed, list updated |

**Responsive:**
- Mobile: Full width, reduced padding (24px → 16px)
- Button text shortens to "Choose File" on small screens

**Accessibility:**
- role: button
- aria-label: "Upload media files"
- Keyboard: Enter/Space opens file picker
- Focus ring: 2px accent outline, 2px offset

---

### Component: FileList

**Purpose:** Display uploaded files with metadata and editing controls.

**Props:**
```typescript
interface FileListProps {
  items: MediaItem[];
  onRemove: (index: number) => void;
  onTextChange: (index: number, text: string) => void;
  onDurationChange: (index: number, duration: number) => void;
}
```

**States:**
| State | Visual | Behavior |
|-------|--------|----------|
| Empty | Hidden (no items) | — |
| Has items | List of file-item rows | Each row: thumb, name, size, text input, duration input, remove button |
| AI item | Purple gradient background | Shows prompt text, duration, remove button |

**Accessibility:**
- Each row: `role="listitem"`
- Remove button: `aria-label="Remove [filename]"`
- Text input: `aria-label="Text overlay for [filename]"`

---

### Component: StepNav

**Purpose:** Show the 3-step wizard progress (Upload → Configure → Render).

**Props:**
```typescript
interface StepNavProps {
  currentStep: 1 | 2 | 3;
  completedSteps: number[];
}
```

**States:**
| State | Visual | Behavior |
|-------|--------|----------|
| Active | Accent background, accent text, accent num | Current step highlighted |
| Completed | Success background, success text, checkmark | Step done |
| Upcoming | Surface background, subtle text, dim num | Not yet reached |

**Accessibility:**
- `role="navigation"` with `aria-label="Creation steps"`
- Each pill: `aria-current="step"` for active
- Screen reader: "Step 2 of 3: Configure"

---

### Component: SettingsPanel

**Purpose:** Form for template configuration (title, subtitle, aspect, CTA).

**Props:**
```typescript
interface SettingsPanelProps {
  title: string;
  subtitle: string;
  aspect: "16:9" | "9:16" | "1:1";
  cta: string;
  onChange: (field: string, value: string) => void;
}
```

**States:**
| State | Visual | Behavior |
|-------|--------|----------|
| Default | All fields filled with defaults | Editable |
| Modified | Fields show user values | Dirty state tracked |

**Accessibility:**
- Each input: associated `<label>` element
- Select: native `<select>` with custom styling
- Focus ring on all interactive elements

---

### Component: RenderPanel

**Purpose:** Trigger render, show progress, display result.

**Props:**
```typescript
interface RenderPanelProps {
  onRender: () => void;
  isRendering: boolean;
  progress: number;  // 0-100
  status: "idle" | "processing" | "done" | "error";
  statusMessage: string;
  resultUrl?: string;
  embedCode?: string;
  error?: string;
}
```

**States:**
| State | Visual | Behavior |
|-------|--------|----------|
| Idle | "Render Video" button, cyan gradient | Clickable |
| Processing | Button disabled, spinner, progress bar | Polling status |
| Done | Green status, video player, download btn, embed btn | Video plays inline |
| Error | Red status, error message | Retry available |

**Accessibility:**
- Button: `aria-disabled` when rendering
- Progress: `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`
- Status: `aria-live="polite"` for screen reader announcements
- Download: `aria-label="Download rendered video"`

---

### Component: AIStepSection

**Purpose:** Input for AI-generated content segments.

**Props:**
```typescript
interface AIStepSectionProps {
  prompt: string;
  duration: number;
  onPromptChange: (prompt: string) => void;
  onDurationChange: (duration: number) => void;
  onRemove: () => void;
}
```

**States:**
| State | Visual | Behavior |
|-------|--------|----------|
| Default | Purple→cyan gradient background, prompt input, duration field | Editable |
| Filled | Same, with user text | Content ready for render |

**Accessibility:**
- Prompt input: `aria-label="Describe the scene for AI generation"`
- Duration: `aria-label="Duration in seconds"`
- Remove: `aria-label="Remove AI step"`

---

### Component: Toast

**Purpose:** Brief notification messages (success, error).

**Props:**
```typescript
interface ToastProps {
  message: string;
  type: "success" | "error";
  duration?: number;  // default 3000ms
}
```

**States:**
| State | Visual | Behavior |
|-------|--------|----------|
| Enter | Slide up from bottom, fade in | Visible |
| Exit | Fade out, slide down | Removed from DOM |

**Accessibility:**
- `role="status"`, `aria-live="polite"`
- Auto-dismiss after duration

---

## Build Handoff

**Target Agent:** `react-vite-tailwind-engineer` (pure SPA, no SSR needed)

**Design System:** Radix + shadcn/ui
- Install: `npx shadcn@latest init`
- Components to use: Button, Input, Select, Label, Progress, Toast
- Theme with locked tokens from DESIGN.md

**Implementation Notes:**
- Use CSS custom properties for all tokens (map from DESIGN.md)
- Dark theme only (no light mode needed for this tool)
- File upload: use native `<input type="file">` with `accept` attribute
- Drag-and-drop: native HTML5 drag events
- Progress polling: `setInterval` with `fetch`, cleanup on unmount
- Video preview: native `<video>` element
- Embed code: `<textarea>` with copy-to-clipboard

**Acceptance Criteria:**
- [ ] All 3 steps render correctly at all breakpoints
- [ ] Drag-and-drop works on desktop and mobile (tap to browse)
- [ ] File list shows thumbnails, metadata, text inputs, duration inputs
- [ ] AI step shows gradient background with prompt input
- [ ] Settings form has 4 fields with proper labels
- [ ] Render button triggers upload → poll → result flow
- [ ] Progress bar advances smoothly
- [ ] Video player plays inline after render
- [ ] Download button saves the mp4 file
- [ ] Embed code is copyable
- [ ] Toast notifications appear for success/error
- [ ] All interactive elements have focus rings
- [ ] Screen reader can navigate the full flow
- [ ] Keyboard-only navigation works (Tab, Enter, Escape)
- [ ] `prefers-reduced-motion` disables animations
- [ ] No banned fonts, colors, or patterns from DESIGN.md
