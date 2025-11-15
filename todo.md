# Kali System: Dispatch - Project Status & TODO

This document serves as a single source of truth for all requested features, their completion status, and a plan for moving forward. Its purpose is to restore clarity and ensure all your requests are tracked and implemented correctly.

---

## ✅ Completed Tasks

This is a log of all features and fixes requested and implemented during this session.

- [x] **UI/UX & Responsiveness:**
  - [x] Make "Items" and "Suppliers" settings tables responsive (75% max-width on large screens).
  - [x] Change the "Drop to Delete" zone color from red to a theme-appropriate blue/indigo.
  - [x] Implement dynamic header dot animations (pulsating green, spinning red, bouncing yellow without a badge).
- [x] **Settings & Data Management:**
  - [x] Implement inline editing for an item's supplier in the "Items" table via a dropdown.
  - [x] Add client-side validation to prevent duplicate item/supplier combinations.
  - [x] Implement "Group by Supplier" view in the "Items" table, toggled by the header click.
  - [x] Refine "Group by Supplier" view: make groups collapsible, hide the redundant "Supplier" column, and enable drag-and-drop item reassignment between groups.
  - [x] Hide "Templates" tab from the settings bar (still accessible from the main header menu).
- [x] **Order Workspace & Cards:**
  - [x] For "Stock" orders, display "in" or "out" status instead of a price in the "On the Way" column.
  - [x] Prevent "On the Way" cards from collapsing immediately after an inline edit; they now collapse on focus loss.
  - [x] Implement a toggleable "Report View" for the "Completed" column, showing a list of today's orders.
  - [x] Fix a drag-and-drop bug where "Completed" orders could not be moved back to the "Today" group.
- [x] **Reports & Telegram:**
  - [x] Reformat the "KALI est." report: remove code block, align totals, use spaces, and update the item line format to `(total) (name)  ((price)) x(qty)`.
  - [x] Create a new "Due Report" table in Settings with a running daily balance and editable "Top Up" amounts.
  - [x] Pre-populate "Due Report" with historical "Top Up" data from an image.
  - [x] Fix a bug where local storage was overwriting the pre-populated "Top Up" data.
  - [x] Overhaul the "KALI Due Report" modal: rename "Today" to "Spendings," support date ranges with per-day inputs, and add a "Unify" option to consolidate multi-day reports.
  - [x] Update the "KALI Due Report" title format to `(Date) KALI Due report`.
  - [x] Add an "Export to CSV" option to a new 3-dot menu in the "Due Report" tab.
- [x] **Navigation & Layout:**
  - [x] Reorganize the main header menu to include a "TABLES" section for data-heavy settings pages.
  - [x] Implement a new "Smart View" layout: a 3-column, multi-store dashboard on desktop and a 2-page swipeable view on mobile.

---

## 🐞 Anomalies & Bugs to Fix

This section lists recurring or notable issues that were encountered and fixed during this session. While resolved, they highlight areas of the codebase that may be brittle.

- [x] **TypeScript Inference Failures:** Several components (`StoreTabs`, `ItemsSettings`, `ManagerReportView`) experienced issues where `.sort()` or `.map()` callback parameters were inferred as `unknown` or `any`, requiring explicit type annotations to fix. This suggests potential inconsistencies in how data arrays are typed or passed.
- [x] **Local Storage State Conflicts:** The pre-populated "Top Up" data was being overwritten by an older state from `localStorage`. The loading logic in `AppContext` was adjusted to handle this, but it highlights a risk when introducing new, hardcoded default states.
- [x] **Component Implementation Errors:** The `ErrorBoundary` component was not correctly extending `React.Component`, causing it to fail. This indicates a need for careful review when creating or modifying class-based components.
- [x] **Drag-and-Drop Edge Cases:** The bug preventing drops onto the "Today" group in the "Completed" column shows that drag-and-drop logic, especially across different zones or states, can have subtle flaws that require thorough testing.

---

## 💡 Recommendations for Improvement

These are concise, one-line suggestions to improve the application's stability and maintainability. Please provide your answer directly below each one.

### Frontend Recommendations

1.  Refactor `AppContext.tsx` state management for better separation of concerns.
    - **My Answer:**
2.  Break down `SupplierCard.tsx` into smaller, more manageable child components.
    - **My Answer:**
3.  Introduce unit tests for critical utility functions (e.g., `messageFormatter.ts`).
    - **My Answer:**
4.  Migrate from Tailwind CDN to a local `tailwind.config.js` for better performance.
    - **My Answer:**

### Backend Recommendations

1.  Add a secret path or token validation to the bot's webhook for enhanced security.
    - **My Answer:**
2.  Implement more robust error logging and alerting for the bot function.
    - **My Answer:**
3.  Separate the different bot command handlers (`/whoami`, `approve_order`, `done_order`) into different modules.
    - **My Answer:**
