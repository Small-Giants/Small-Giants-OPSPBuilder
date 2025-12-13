# OPSP Strategy App Design Guidelines

## Design Approach
**System-Based Approach**: Using Material Design principles adapted for productivity tools, emphasizing clarity, efficiency, and data density while maintaining visual appeal for strategic planning workflows.

## Core Design Elements

### Color Palette
**Light Mode:**
- Primary: 224 71% 4% (Deep navy for headers, key elements)
- Secondary: 224 71% 8% (Slightly lighter for secondary text)
- Background: 0 0% 98% (Clean white background)
- Surface: 0 0% 96% (Cards and panels)
- Accent: 217 91% 60% (Bright blue for interactive elements)

**Dark Mode:**
- Primary: 224 71% 96% (Light text on dark)
- Secondary: 224 71% 88% (Secondary text)
- Background: 224 71% 4% (Dark navy background)
- Surface: 224 71% 8% (Elevated surfaces)
- Accent: 217 91% 70% (Brighter blue for dark mode)

### Typography
- **Primary Font**: Inter (Google Fonts)
- **Display Font**: Inter (weights: 400, 500, 600, 700)
- **Hierarchy**: text-xs through text-2xl, emphasis on readability in data-dense layouts

### Layout System
**Spacing Units**: Consistent use of 2, 4, 6, 8, 12, 16 Tailwind units
- Micro spacing: p-2, m-2 (form elements, buttons)
- Component spacing: p-4, m-4 (cards, sections)
- Layout spacing: p-8, m-8 (major sections, page margins)

### Component Library

**Navigation & Structure:**
- Fixed sidebar navigation with collapsible sections
- Breadcrumb navigation for deep hierarchies
- Tab-based section switching within OPSP canvas
- Floating action buttons for primary actions

**Data Display:**
- Card-based layout for OPSP sections
- Progressive disclosure for complex forms
- Inline editing with clear save/cancel states
- Drag-and-drop visual indicators
- Progress bars and completion indicators

**Interactive Elements:**
- Form controls with clear validation states
- Modal dialogs for complex workflows
- Tooltip system for contextual help
- Comment bubbles with @mention support

**Specialized Components:**
- SWOT matrix with quadrant visualization
- KPI dashboard with chart integration
- Assessment scoring interfaces (1-5 scale)
- PDF export preview overlay

### Key UX Principles

**Information Architecture:**
- One-page canvas as primary workspace
- Jump navigation between sections
- Contextual sidebars for detailed editing
- Clear visual hierarchy separating strategic vs operational data

**Interaction Patterns:**
- Click-to-edit functionality throughout
- Auto-save with visual confirmation
- Real-time collaboration indicators
- Version history accessible but non-intrusive

**Responsive Behavior:**
- Desktop-first design (primary use case)
- Tablet adaptation with preserved functionality
- Mobile view prioritizes viewing over editing

### Visual Treatments

**Data Visualization:**
- Clean, minimal charts using Chart.js
- Color coding for status indicators (red/yellow/green)
- Subtle animations for state changes only

**Content Organization:**
- Strategic sections use larger typography and spacing
- Tactical sections more compact for efficiency
- Clear section dividers and groupings
- Consistent iconography from Heroicons

This design system prioritizes clarity and functionality while maintaining visual appeal appropriate for executive-level strategic planning tools.