# Kali System: Dispatch - Project Status & TODO

This document serves as a single source of truth for all requested features, their completion status, and a plan for moving forward. Its purpose is to restore clarity and ensure all your requests are tracked and implemented correctly.

---

## ✅ Completed Tasks

This is a log of all features and fixes requested and implemented during this session.

- [x] Constrain supplier card width to 1/3 of the column.
- [x] Restore the manual column view switcher button.
- [x] Ensure all content is left-aligned (remove centering).
- [x] Reduce supplier name font size to match the payment badge.
- [x] Add Telegram icon and 'Add Item' (+) button to the supplier card header.
- [x] Implement comprehensive drag-and-drop for items and cards (tap-to-show, merge, etc.).
- [x] Fix all module specifier errors for `messageFormatter`.
- [x] Remove confirmation, merge, move, and variant/stock modals and functionality.
- [x] Implement a new fully responsive layout with mobile swipe gestures.
- [x] Overhaul the Settings page UI (adjust tables, remove margins, fix toolbars).
- [x] Shorten item context menu labels ("Edit Master", "Set Price").
- [x] Add a red delete button with a trash icon to the Edit Item modal.
- [x] Display item total price as a badge and fix quantity alignment.
- [x] Replace header buttons with animated colored dots and hide the main app title.
- [x] Fix multi-column layout bug where empty columns would collapse.
- [x] Display total order price in the card header next to the payment badge.
- [x] Remove currency symbols ($) from all price displays.
- [x] Increase the size of header dots and restore the main header menu.
- [x] Correctly handle the 2-column view on wide screens by leaving the 3rd column empty.
- [x] Adjust supplier card border thickness and color.
- [x] Overhaul the receipt modal with filters, a new format, and a working print button.
- [x] Move order to 'On the Way' when Telegram message is sent.
- [x] Update the Gemini API key.
- [x] Overhaul the Telegram Bot Options modal with custom message functionality.
- [x] Add long-press functionality to the dispatch Telegram button (move & copy).
- [x] Add a 'Contact' column to the Suppliers table and include it in the order message.
- [x] Update AI parsing rules for aliases (e.g., french fries) and special quantities (mayonnaise).
- [x] Ensure store location is correctly formatted as a link in order messages.
- [x] Correct the visibility of the Telegram icon (only on 'On the Way' cards with a contact).
- [x] Unify the payment method and total amount into a single badge group.
- [x] Implement toggling between quantity and price numpads by pressing '.'.
- [x] Fix bug where copying an order message used stale supplier data.
- [x] Implement inline editing for item names on second click.
- [x] Add a date selection modal for the "KALI due" report.
- [x] Standardize all report item lines to the format: `(total) (name) (price) x(qty)`.
- [x] Implement the "Press Done" button option and two-step Telegram workflow.

- [x] Remove the deleted `ResizableTable` component and its imports, replacing it with a standard table.
- [x] Merge the `/whoami` command into the main Telegram bot backend file.

---

## 🧐 Functions for Review

These files have been edited frequently or are highly complex. They are the most likely to contain hidden anomalies or incomplete logic. I recommend a focused review of these specific areas.

*   **`src/context/AppContext.tsx`**: This file is the core of the application's state. Its size and complexity make it a high-risk area for bugs.
*   **`src/components/SupplierCard.tsx`**: The "danger zone" file. It contains a massive amount of state and logic for UI interactions, modals, and drag-and-drop. It should be reviewed to ensure all interactions work as expected after the many surgical edits.
*   **`src/utils/messageFormatter.ts`**: This file has been edited multiple times to get the formatting right. A final check is needed to confirm all report and message formats are 100% correct and consistent.
*   **`supabase/functions/telegram-bot/index.ts`**: This backend file now handles multiple callbacks and commands. It should be reviewed to ensure the `OK` -> `Done` workflow and the `/whoami` command are both stable.

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
