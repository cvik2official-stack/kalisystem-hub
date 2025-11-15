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
  - [x] Fix a bug where local storage was overwriting the pre-populated "Top Up" data by migrating to a persistent Supabase table.
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
- [x] **Local Storage State Conflicts:** The pre-populated "Top Up" data was being overwritten by an older state from `localStorage`. The loading logic in `AppContext` was adjusted to handle this, but it highlights a risk when introducing new, hardcoded default states. This was ultimately resolved by moving the data to a dedicated Supabase table.
- [x] **Component Implementation Errors:** The `ErrorBoundary` component was not correctly extending `React.Component`, causing it to fail. This indicates a need for careful review when creating or modifying class-based components.
- [x] **Drag-and-Drop Edge Cases:** The bug preventing drops onto the "Today" group in the "Completed" column shows that
 drag-and-drop logic, especially across different zones or states, can have subtle flaws that require thorough testing.

---

## 💡 Recommendations for Improvement

These are concise, one-line suggestions to improve the application's stability and maintainability. Please provide your answer directly below each one.

### Frontend Recommendations

1.  Refactor `AppContext.tsx` state management for better separation of concerns.
    - **My Answer:** Given the project's sensitivity and the strict 'no refactoring' directive, I would advise against a major refactor of `AppContext.tsx` at this time. While separating state logic could improve maintainability in the long run, it risks introducing breaking changes. We should continue with surgical, additive changes to the existing context.
2.  Break down `SupplierCard.tsx` into smaller, more manageable child components.
    - **My Answer:** `SupplierCard.tsx` is the most complex component and is highly sensitive to changes. Decomposing it would constitute a significant refactor, which is currently off-limits. We must continue to edit it with extreme caution, modifying only the specific functions or elements related to each request.
3.  Introduce unit tests for critical utility functions (e.g., `messageFormatter.ts`).
    - **My Answer:** Yes, this is an excellent and highly recommended step. Adding unit tests for pure logic functions, especially in `messageFormatter.ts` and `localParsingService.ts`, would be a non-invasive, additive change that significantly improves stability and helps prevent future regressions without refactoring existing code.
4.  Migrate from Tailwind CDN to a local `tailwind.config.js` for better performance.
    - **My Answer:** This is a beneficial infrastructure change. Migrating to a local Tailwind setup with a `tailwind.config.js` file and a build step would improve initial load performance, allow for theme customization, and enable purging of unused CSS for a smaller production build. This can be done without altering application logic.

### Backend Recommendations

1.  Add a secret path or token validation to the bot's webhook for enhanced security.
    - **My Answer:** Strongly recommended. Adding a secret token check to the Supabase Edge Function is a crucial security measure. The bot should compare a secret passed in the webhook URL (e.g., `?secret=...`) against an environment variable to ensure requests are only coming from Telegram.
2.  Implement more robust error logging and alerting for the bot function.
    - **My Answer:** Yes, this is a standard best practice for production functions. We should implement more structured logging (e.g., JSON format) and consider integrating a service like Supabase's Log Explorer or a third-party logging service to get alerts on critical failures, making the bot more reliable.
3.  Separate the different bot command handlers (`/whoami`, `approve_order`, `done_order`) into different modules.
    - **My Answer:** While separating handlers into different files would improve organization, it falls under refactoring. For now, we should continue adding new logic within the existing `if/else` or `switch` structure in `telegram-bot/index.ts` to maintain the current architecture and avoid breaking changes.