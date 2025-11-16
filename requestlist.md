# Request List (Last 20)

1.  **Re-implement Auto Currency Conversion:** All price inputs should automatically convert Khmer Riel (values > 1000) to USD by dividing by 4000.
2.  **Overhaul Smart View & Report UI:**
    *   Remove background colors and extra spacing from report views for a compact, flat list design.
    *   In the report view, group items first by **Store** (in an expanded accordion), then by **Supplier**.
    *   Supplier groups should be draggable.
    *   Remove `(Report)` text from all column titles.
3.  **Fix Report Item Line Formatting:**
    *   Display the editable price on the same line as the item, right-aligned.
    *   Remove the redundant `(Store Name)` from each item line.
    *   Ensure list bullets (`•`) are visible on desktop but hidden on mobile.
4.  **Add Quick Action Icons:**
    *   Add `+` (New Card) and `list` (Paste from Clipboard) icons to the "Dispatch" column header.
    *   Add `+` (Add Item) and Telegram "send" icons to the headers of cards in the "Dispatch" column.
5.  **Fix "Completed" Column:** Ensure "Today" and "Yesterday" groups are always displayed, even if they are empty.
6.  **Implement Custom Supplier Sorting:** All views should sort suppliers in the order: KALI, STOCK, LEES, ...rest (alphabetical), PISEY.
7.  **Add KALI Color Coding:** Prices for all KALI-related orders (by supplier or payment method) should be displayed in a distinct purple color.
8.  **Allow Price on Stock Orders:** Update the `SupplierCard` to allow for an editable price field on stock movement items.
9.  **Remove Header Icon:** Remove the round logo icon that functioned as a "Go Back" button from the main header.
10. **Refine PWA Behavior:**
    *   Set the PWA `display` mode to `standalone` to make the native status bar visible.
    *   Implement a robust "network-first, falling back to cache" strategy in the service worker for better offline support.
11. **Implement Auto Smart View:** The app should automatically switch to Smart View when the device is in a landscape orientation.
12. **Fix Smart View Layout:** Correct the Smart View to be a 3-column report layout (`Dispatch`, `On the Way`, `Completed`).
13. **Fix `EditTemplateModal` Bug:** Ensure that changes to the "Message Template" are saved correctly when the save button is clicked.
14. **Fix `SupplierCard` Collapse Behavior:** Prevent cards in the "On the Way" and "Completed" columns from collapsing immediately after an inline edit.
15. **Implement Interactive Notifications:** Add "Received" and "ETA ?" buttons to the notification panel for "On the Way" orders.
16. **Create `requestlist.md`:** Create this file to track recent requests.
17. **Refine Due Report Table:**
    *   Hardcode the initial balance and remove the input field.
    *   Rename columns to "STI" and "O2".
    *   Add a direct "Send to Telegram" shortcut icon to each row.
18. **Remove Drag-and-Drop from Items Table:** Simplify the Items settings page by removing the D&D functionality for reassigning items.
19. **Add "Stock" Tab (and then remove it):** This request was made and then rescinded due to implementation issues, resulting in the final decision to remove all references to it to fix compilation errors.
20. **Secure Telegram Bot:** Add secret token validation to the webhook to prevent unauthorized access.
