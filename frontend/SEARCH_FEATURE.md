# Chat Search Feature

This document describes the new search functionality added to the SecureChat application.

## Features

### 🔍 **Real-time Search**
- Search through chat messages as you type
- 300ms debounced search for optimal performance
- Case-insensitive text matching

### 🎯 **Search Scope Options**
- **Current Conversation**: Search only in the selected user's chat
- **All Conversations**: Search across all your conversations
- Toggle between modes using the checkbox

### ✨ **Text Highlighting**
- **Yellow highlighting**: All search matches
- **Red highlighting**: Currently selected/active match
- **Message highlighting**: Current result message gets special styling

### ⌨️ **Keyboard Shortcuts**
- **Ctrl+F**: Focus search input (standard browser shortcut)
- **Enter**: Navigate to next result
- **Shift+Enter**: Navigate to previous result
- **Escape**: Clear search and results

### 🧭 **Navigation**
- **Up/Down arrows**: Navigate between search results
- **Click on results**: Jump directly to a specific result
- **Auto-scroll**: Messages automatically scroll into view when navigating

## How to Use

### 1. **Start Searching**
- Click on the search input field, or
- Press `Ctrl+F` to focus the search input
- Type your search query

### 2. **Navigate Results**
- Use the up/down arrow buttons
- Press Enter/Shift+Enter
- Click on any result in the results list

### 3. **Change Search Scope**
- Check/uncheck "All conversations" to toggle between:
  - Current conversation only
  - All your conversations

### 4. **Clear Search**
- Click the × button in the search input
- Press Escape key
- Clear the search text

## Search Results Display

### **Result Information**
Each search result shows:
- **Sender**: Who sent the message
- **Conversation**: Which conversation it's from (when searching all conversations)
- **Preview**: Text with highlighted search terms
- **Timestamp**: When the message was sent

### **Visual Indicators**
- **Current result**: Highlighted in blue with red border
- **Search matches**: Yellow background for all matches
- **Active match**: Red background for the currently selected match
- **Conversation badges**: Green for current conversation, orange for others

## Technical Details

### **Performance Optimizations**
- Debounced search (300ms delay)
- Efficient text matching algorithms
- Lazy loading of search results

### **Search Algorithm**
- Case-insensitive substring matching
- Multiple matches per message supported
- Real-time updates as you type

### **Integration**
- Works with existing message storage
- Compatible with encrypted/decrypted messages
- Preserves all existing chat functionality

## Browser Compatibility

- **Modern browsers**: Full functionality
- **Keyboard shortcuts**: Works in all browsers
- **Auto-scroll**: Smooth scrolling in modern browsers

## Future Enhancements

Potential improvements for future versions:
- Regular expression search
- Search filters (date range, sender, etc.)
- Search history
- Export search results
- Advanced search operators
