# DataAsk Refactoring Plan

## Objective
Simplify the codebase while maintaining the existing UI/UX quality. Focus on reducing complexity, improving maintainability, and streamlining user workflows.

## Guiding Principles
1. **Preserve the UI**: Keep the clean, modern interface intact
2. **Simplify Features**: Remove unnecessary complexity without losing core functionality
3. **Improve Performance**: Address current bottlenecks
4. **Enhance Maintainability**: Smaller components, better organization
5. **User-First**: Make workflows more intuitive

## Phase 1: Feature Simplification (Week 1-2)

### 1.1 Streamline File Import
**Current**: Multi-step wizard with complex configuration
**Target**: Single-step import with smart defaults

**Changes**:
- Remove manual column type configuration step
- Use automatic type detection with 95% confidence
- Import immediately after file selection
- Show progress inline instead of modal
- Simplify to: Drop file → Import → Done

**Files to modify**:
- `FileImportModal.tsx` - Simplify to single-step
- `api/files.ts` - Remove schema detection endpoint
- Remove unnecessary components

### 1.2 Simplify Connection Management
**Current**: Complex add/edit/test flow
**Target**: Quick connect with minimal configuration

**Changes**:
- Remove connection editing (only add/remove)
- Combine test and save into single action
- Use file picker for SQLite files
- Auto-generate connection names from filename
- Remove connection type dropdown (SQLite only)

**Files to modify**:
- `ConnectionModal.tsx` - Simplify to add-only
- `SchemaBrowser.tsx` - Remove edit functionality

### 1.3 Reduce Chat Complexity
**Current**: 924-line component with history, search, suggestions
**Target**: Focused query interface

**Changes**:
- Remove persistent query history
- Keep only current session messages
- Remove history search/filter
- Remove suggested questions
- Simplify message components

**Files to modify**:
- `ChatPanel.tsx` - Major refactoring needed
- Remove localStorage history management

## Phase 2: Component Refactoring (Week 2-3)

### 2.1 Break Down Large Components

#### ChatPanel Refactoring
Split into:
- `QueryInput.tsx` - Input field and send button
- `MessageList.tsx` - Display messages
- `Message.tsx` - Individual message component
- `SqlDisplay.tsx` - SQL code display
- `useChatState.ts` - Custom hook for chat logic

#### DataVisualizer Refactoring
Split into:
- `ChartSelector.tsx` - Chart type selection logic
- `BarChart.tsx` - Bar chart component
- `LineChart.tsx` - Line chart component
- `PieChart.tsx` - Pie chart component
- `KpiCard.tsx` - KPI display component
- `useChartData.ts` - Data transformation hook

### 2.2 Extract Reusable Components
Create component library:
```
components/
  ui/
    Button.tsx
    Modal.tsx
    Card.tsx
    Spinner.tsx
    ErrorMessage.tsx
    EmptyState.tsx
    Tooltip.tsx
```

### 2.3 Implement Custom Hooks
```
hooks/
  useDatabase.ts    - Database operations
  useQuery.ts       - Query execution
  useImport.ts      - File import logic
  useResizable.ts   - Panel resizing (exists)
  useLocalStorage.ts - Storage operations
```

## Phase 3: State Management (Week 3-4)

### 3.1 Implement Context API
Create contexts for:
- `DatabaseContext` - Current connection, schema
- `QueryContext` - Active query, results
- `UIContext` - Panel sizes, preferences

### 3.2 Centralize API Calls
Move all API calls to dedicated hooks:
- Remove direct fetch calls from components
- Implement proper loading/error states
- Add request cancellation

### 3.3 Optimize Re-renders
- Memoize expensive computations
- Use React.memo for pure components
- Implement proper dependency arrays

## Phase 4: Performance Optimization (Week 4)

### 4.1 Implement Virtualization
- Add react-window for large result sets
- Virtualize table rows in results display
- Lazy load schema browser items

### 4.2 Optimize File Import
- Stream large files instead of loading entirely
- Process in chunks with Web Workers
- Show real-time progress

### 4.3 Code Splitting
- Lazy load heavy components (charts, modals)
- Split vendor bundles
- Implement route-based splitting

## Phase 5: Remove Unused Features (Week 5)

### 5.1 Remove Authentication
**If not actively used**:
- Remove auth components and routes
- Remove JWT/cookie handling
- Simplify backend middleware
- Remove user-specific features

### 5.2 Simplify Backend
- Remove prepared multi-database support
- Remove complex connection configs
- Simplify error handling
- Remove unused API endpoints

### 5.3 Clean Dependencies
- Remove unused npm packages
- Update outdated dependencies
- Reduce bundle size

## Implementation Order

### Week 1: Quick Wins
1. Simplify file import flow
2. Remove query history persistence
3. Simplify connection management

### Week 2: Component Breakdown
1. Refactor ChatPanel into smaller components
2. Extract reusable UI components
3. Start DataVisualizer refactoring

### Week 3: State & Architecture
1. Implement Context API
2. Create custom hooks
3. Centralize API calls

### Week 4: Performance
1. Add virtualization
2. Implement code splitting
3. Optimize bundle size

### Week 5: Cleanup
1. Remove unused features
2. Update documentation
3. Final testing and polish

## Success Metrics

### Code Quality
- [ ] No component > 300 lines
- [ ] Average component < 150 lines
- [ ] 80%+ code coverage
- [ ] Zero ESLint warnings

### Performance
- [ ] Initial load < 3 seconds
- [ ] File import 2x faster
- [ ] Smooth scrolling with 10k+ rows
- [ ] Bundle size < 500KB

### User Experience
- [ ] File import in 2 clicks
- [ ] Query execution in 1 click
- [ ] No loading spinners > 2 seconds
- [ ] Clear error messages

## Risk Mitigation

### Preserving UI Quality
- Create visual regression tests
- Document current UI patterns
- Review each change against original

### Feature Parity
- List core features to preserve
- Get user feedback early
- Keep rollback plan ready

### Testing Strategy
- Unit tests for new components
- Integration tests for workflows
- E2E tests for critical paths

## Post-Refactoring

### Documentation Updates
- Update README with new architecture
- Create component documentation
- Update API documentation
- Add inline code comments

### Developer Experience
- Set up Storybook for components
- Create development guidelines
- Add pre-commit hooks
- Improve error messages

## Conclusion

This refactoring plan focuses on simplifying the codebase while maintaining the polished UI that users expect. By breaking down complex components, streamlining workflows, and removing unnecessary features, we can create a more maintainable and performant application.

The key is to work incrementally, testing each change thoroughly, and always keeping the user experience as the top priority.