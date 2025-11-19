# Recent User Requests

1.  Smart view implementation.
2.  Remove edit mode toggle (make edit functions always available).
3.  Enable edit functions by default (Telegram button, inline edit name/price).
4.  Implement quantity editing via modal.
5.  Implement payment method editing via modal.
6.  Add "Add Item" field to order cards.
7.  Implement auto-completion for "Add Item".
8.  Load last quantity ordered when adding an item via auto-completion.
9.  Match total amount text color to the payment method badge color.
10. Ensure Telegram button is enabled/visible by default.
11. Ensure inline name and price editing is enabled by default.
12. Update Manager Report View to support new "Smart View" columns.
13. Fix total amount display in report view.
14. Implement smart view with 3 columns (Dispatch, On The Way, Completed).
15. Ensure "Add Item" is available in Dispatch and On The Way columns.
16. Display "in" or "out" for stock movements in report view.
17. Create this request list file.
18. Add Shortcut Tiles for quick actions: Send report, Paste a list, Add card, Quick order.
19. New function "Quick Order" (CV2 store initially) to save and reuse order cards.
20. Implement a save zone for dragging cards to create quick orders.
21. Add a `/quickorder` command for the Telegram bot.
22. Ensure quick order messages are sent to both the supplier and the store via Telegram.
23. Fix KALI PiP to-do list persistence (ticked items, sections).
24. Fix KALI PiP section drag-and-drop functionality.
25. Add a "Share" button to the KALI PiP window.
26. Implement new Telegram bot commands: `/est` and `/due`.
27. Implement PWA "app running" notification with "All Orders" and "Close PiP" actions.
28. Verify all PWA features (Tiles, Share Target, PiP) are correctly configured.



# Project: Kali System Dispatcher (Rebuild Specification)

**Role:** Lead Frontend Architect / Full-Stack Engineer
**Objective:** Rebuild the "Kali System Dispatcher" PWA from scratch to eliminate technical debt while strictly preserving ALL existing business logic and features.
**Tech Stack:** React 18, TypeScript, Tailwind CSS, Supabase (DB + Realtime), Google GenAI SDK (`@google/genai`), Framer Motion.

---

## 1. Architecture & Core Principles

*   **Single Source of Truth:** A unified `GlobalStore` (using React Context or Zustand) must manage orders, items, suppliers, and UI state.
*   **Optimistic UI:** All mutations (drag-drop, edits) must update local state immediately before syncing with Supabase.
*   **Offline First:** The app is a PWA. It must function (read/write) offline and sync when online.
*   **Strict Typing:** All entities (`Order`, `Item`, `Supplier`) must match the Supabase schema exactly.

---

## 2. Data Schema (Supabase)

The application MUST support these exact tables and relationships:

*   **`stores`**: `id, name, chat_id, location_url`
*   **`suppliers`**: `id, name, payment_method (CASH|ABA|KALI|STOCK|MISHA), chat_id, bot_settings (JSON), contact`
*   **`items`**: `id, name, unit, supplier_id, stock_quantity`
*   **`orders`**: `id, order_id, store, supplier_id, status (dispatching|on_the_way|completed), items (JSONB), is_acknowledged, payment_method, invoice_amount, completed_at, reminder_sent_at`
    *   *Note:* `items` JSONB structure: `[{ itemId, name, quantity, unit, price}]`
*   **`item_prices`**: `id, item_id, supplier_id, price, unit`
*   **`quick_orders`**: `id, name, store, supplier_id, items (JSONB)`
*   **`due_report_top_ups`**: `date, amount`

---

## 3. UI Layout & Navigation

*   **Global Theme:** Dark Mode Industrial (`#171923` background). High contrast text.
*   **Header:**
    *   **Traffic Lights:**
        *   🔴 Red: Exit Smart/Manager View (Reset to default).
        *   🟡 Yellow: Notification Bell (w/ wobbling animation on new).
        *   🟢 Green: Sync Status (Spinning = Syncing, Pulse = Idle).
    *   **Store Tabs:** (`ALL, CV2, KALI, SHANTI, STOCKO2, WB`).
        *   *Mobile:* Wraps to a new line.
    *   **Menu:** 3-dots menu for "Quick Orders", "Kali Report", "PiP Mode", "Settings", "Webhook".
*   **PiP Window:** A detached floating window for the "Kali To-Do List" (Checklist mode).

---

## 4. The Order Workspace (Main Dashboard)

Three distinct columns (Stacks on mobile).

### Column 1: Dispatch (Drafts)
*   **Header:** Store Name + Buttons: `[+ Supplier]` and `[Paste List]`.
*   **Functionality:**
    *   **Paste List:** Open modal -> Text Area -> Use **Gemini AI** to parse text into `{item, qty, unit}` -> Fuzzy match against DB -> Group by Supplier -> Create Orders.
    *   **Add Supplier:** Open modal with search -> Select Supplier -> Create empty order card.

*   **Order Cards:**
    *   Supplier header: Show store name, Show Supplier Name, payment badge+total, telegram button, + button, collapse button.
    *   **Actions:** `[+ Item]` button, `[Telegram]` send button (Blue).
    *   **Telegram Logic:** Sends HTML formatted message with Inline Buttons (Attach Invoice, Missing Item, OK, Driver on Way).

### Column 2: On The Way (Sent)
*   **Cards:** Collapsible.
*   **Visuals:**
    *   **Stock Logic:** If Supplier or Payment is `STOCK`, display items with "IN" (Green) or "OUT" (Yellow) indicators.
    *   **KALI Logic:** If Payment is `KALI`, price text must be **Purple**.
*   **Actions:** Inline edit Name/Price. Click Quantity -> Numpad.

### Column 3: Completed (History)
*   **Layout:** **Unified Report View** (Critical).
    *   **Grouping:** Date (Today/Yesterday) -> Store (Accordion) -> Supplier (Compact Row).
    *   **Visuals:** No card backgrounds. Minimalist list.
    *   **Rows:** `Item Name` ....... `Qty` `Price`.
    *   **Price Logic:** Editable inline. **Auto-convert:** If input > 1000, divide by 4000.
    *   **Totals:** Show total per supplier and per store.

---

## 5. Global Business Logic & Rules (Strict Adherence)

1.  **Currency Input:** ANY price input (Numpad, Inline, Settings) must apply: `if (value > 1000) value = value / 4000`.
2.  **Sorting:** Suppliers MUST always sort: `KALI`, `STOCK`, `LEES`, then Alphabetical, then `PISEY` last.
3.  **Smart View:** Default view on desktop. Shows columns: Dispatch | On The Way | Completed. Filtered by `activeStore` (or ALL).
4.  **Drag & Drop:**
    *   Drag Card -> Trash (Delete).
    *   Drag Card -> Save (Create Quick Order).
    *   Drag Card -> Change Supplier (Open Modal).
    *   Drag Item -> Another Card (Move Item).
5.  **Telegram Bot:**
    *   Must support commands: `/quickorder`, `/est`, `/due`, `/whoami`.
    *   Must handle callbacks for order acknowledgement.

---

## 6. Settings & Tools

*   **Items DB:** Searchable table. Inline edit Name/Price. Group by Supplier. Export CSV.
*   **Suppliers DB:** Edit Chat ID, Payment Method, Bot Settings (Templates).
*   **Reports:**
    *   **Kali Unify Report:** Complex text report of all KALI spending, grouped by Store, with "Previous Due" and "Top Up" calculation.
    *   **Due Report:** Daily financial report.
*   **Quick Orders:** Save current "Dispatch" state as a template. Restore via menu or bot.

---

## 7. Execution Strategy

1.  **Scaffold Types:** Copy `src/types.ts` exactly to ensure compatibility.
2.  **Service Layer:** Implement `supabaseService` and `geminiService` first.
3.  **State:** Build the `AppContext` replacer (Store).
4.  **Components:** Build atomic components (`Numpad`, `SupplierCard`, `ReportRow`).
5.  **Assembly:** Construct the `OrderWorkspace` and `ManagerReportView`.
6.  **Refinement:** Apply the animations and strict CSS styling.