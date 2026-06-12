# Quick Search System ("Anysearch")

## User Perspective
The Quick Search system, internally referred to as "Anysearch" or the Command Palette, allows users to rapidly find any task within the application no matter where it is located.

- **Triggering**: You can open the search palette by Double-Tapping the `Shift` key quickly, pressing **Cmd + K** (or **Ctrl + K**), or by clicking the "Anysearch" button in the top navigation bar.
- **Search Capabilities**: Once open, immediately begin typing to perform an omnipresent, instantaneous search. The system searches across task titles, internal markdown descriptions, and tag arrays. 
- **Filtering**: You can restrict the search utilizing functional "Scope" chips. For example, click "Descriptions Only" to restrict queries explicitly to task bodies, or scope the search exclusively into the "Archived" or "Trash bin" areas.
- **Visuals and Navigation**: The interface presents realtime results emphasizing precisely where the matching snippet occurred. Highlighted text receives a stark green outline. You can use the `Up` and `Down` arrow keys to cycle through the options and press `Enter` to pop open the editor for a given task immediately.

## Technical Explanation
The Quick Search is engineered as an entirely local, zero-latency client-side system. Since task data is loaded into memory on application start, text processing occurs instantly without the necessity of HTTP trips.

1. **Hotkey Binding (`src/components/CommandPalette.tsx`)**:
   Inside its `useEffect` listeners, the component attaches event capturers to `window`. 
   - For `Cmd + K`, it uses standard modifier tracking.
   - For the "Double Shift" macro, it tracks `e.key === 'Shift'` timestamps inside a `useRef`. If the difference between the current time and the cached `lastShiftTimeRef` is greater than 0 but less than 300 milliseconds, it toggles the modal's active state.

2. **Reactive Filtering (Local Engine)**:
   Whenever the user inputs into the palette or switches scopes, a complex `useMemo` block triggers.
   - It aggregates the unified pool of current data from `useStore` (`tasks`, `archivedTasks`, and `trashedTasks`).
   - It iterates through the combined list and performs simple `.includes()` evaluations of the low-cased query variable against the corresponding task properties.
   - As it evaluates tasks, it categorizes them into `SearchResult` wrappers which keep track of why the task was appended (`matchType`: `'title'` | `'content'` | `'tag'`) and sorts them accordingly. The sorting prioritization weights: Name hits > Tag/Content hits, and gives weight to active tasks over archived resources.

3. **Component Snippeting and Marking**:
   A custom `<HighlightText>` sub-component breaks large strings into arrays of split matches using regular expressions. It maps these fragments back to JSX, wrapping exact hit matches with a heavily styled Tailwind `<mark>` entity. For the task body/description, a helper function `getSnippet()` trims off excess long text so it intelligently previews the contextual words exactly 30 characters before and 50 characters after the hit. 
   
4. **Transitions**:
   Framer Motion (`motion/react`) surrounds the popup component, offering smooth scaling (`opacity`, `scale: 0.97`, `y: -8`) animations and clean unmounting using `<AnimatePresence>` for an elegant user experience.
