# HeroBanner Component - Work Record

## Task
Build a Netflix-quality HeroBanner component at `/home/z/my-project/src/components/HeroBanner.tsx`

## Completed
- Full-width hero section with `clamp(400px, 70vh, 700px)` height
- Multiple gradient overlays: bottom gradient, left gradient, vignette effect, top subtle gradient
- Content area at bottom-left with: community rating (gold badge with Star icon), title (text-4xl/5xl/6xl), type/year/duration/resolution/audio badges, description (line-clamp-3), genre colored pills, PLAY and MORE INFO action buttons
- Auto-rotation every 8 seconds through top 6 items
- Smooth crossfade transitions with framer-motion (opacity + scale on background, opacity + translateY on content)
- Manual navigation with left/right arrows (show on hover with glassmorphism styling)
- Dot indicators at bottom-right with active state animation
- Progress bar at bottom showing auto-rotation timing
- Genre color map with 14 genre-specific colors
- Glassmorphism on all badges (backdrop-blur-md with semi-transparent backgrounds)
- Mobile-responsive layout
- Uses: useAppStore, Button, Badge, framer-motion, lucide-react icons
- ESLint passes cleanly, dev server responds with 200
