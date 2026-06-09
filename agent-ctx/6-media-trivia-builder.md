# Task 6 - Media Trivia Builder

## Work Summary

Built the Media Trivia feature for MyTube — a Netflix-style streaming app.

### Files Created
1. `src/app/api/ai/trivia/route.ts` — API route for generating trivia using LLM
2. `src/components/MediaTrivia.tsx` — Interactive trivia component with facts and quiz modes

### Files Modified
1. `src/app/page.tsx` — Added MediaTrivia import and placement in middleSlot

### Key Implementation Details
- API uses z-ai-web-dev-sdk with singleton pattern for LLM calls
- Two modes: 'facts' (5 rotating facts) and 'quiz' (5 interactive questions)
- Robust JSON parsing with regex extraction from markdown code blocks
- Fallback content generation when LLM is unavailable
- Auto-rotating fact cards with 8-second intervals and card-flip animation
- Interactive quiz with correct/wrong highlighting, explanations, score tracking
- Glassmorphism styling consistent with other AI sections
- Responsive design, no indigo/blue primary colors
- Handles empty watch history gracefully
