# Drag and Drop Data Tokens Feature

## Overview

This feature allows users to drag variables/columns from the dataframe browser (left panel) into the chat input (middle panel), where they render as rich inline tokens. This makes it easy to reference specific data fields when asking questions about your data.

## How It Works

### Dragging from DataFrame Browser

1. **Expand a DataFrame**: Click the chevron next to any dataframe in the left panel to expand it and see its columns
2. **Drag Columns**: Click and drag any column name from the expanded list
3. **Visual Feedback**: The column will show a drag indicator (↖) and you'll see a custom drag image
4. **Drop Zone**: The chat textarea will highlight with a blue border when you drag over it

### Dropping in Chat

1. **Drop Zone**: The chat textarea accepts dropped data tokens
2. **Token Display**: Dropped tokens appear as blue chips above the textarea
3. **Remove Tokens**: Click the × on any token to remove it from the input
4. **Send with Tokens**: When you send a message, the tokens are included with your question

### Token Rendering

- **In Input**: Tokens appear as removable chips above the textarea
- **In Messages**: Tokens appear as non-removable chips below the message content
- **Visual Design**: Blue background with database icon and truncated text
- **Tooltips**: Hover over tokens to see full dataframe.column information

## Technical Implementation

### Components

- **DataToken.tsx**: Reusable component for rendering data tokens
- **DataFrameBrowser.tsx**: Updated to make columns draggable
- **ChatPanel.tsx**: Updated to handle drops and render tokens
- **DataAskApp.tsx**: Coordinates drag events between components

### Data Flow

1. User drags column → `onDataTokenDrag` callback → `DataTokenData` object
2. User drops in chat → `handleDrop` → `inputTokens` state
3. User sends message → `dataTokens` included in message
4. Message renders → `DataToken` components displayed

### Key Features

- **Type Safety**: Full TypeScript support with `DataTokenData` interface
- **Visual Feedback**: Drag indicators, drop zone highlighting
- **Error Handling**: Graceful fallback for invalid drops
- **Accessibility**: Proper ARIA labels and keyboard support
- **Responsive**: Tokens truncate appropriately on smaller screens

## Usage Examples

1. **Simple Query**: Drag "age" column → Type "What's the average?" → Send
2. **Multiple Fields**: Drag "salary" and "department" → Type "Show me the distribution" → Send
3. **Complex Analysis**: Drag multiple columns → Type "Create a correlation matrix" → Send

The AI will understand exactly which data fields you're referencing and can generate more precise code and analysis.
