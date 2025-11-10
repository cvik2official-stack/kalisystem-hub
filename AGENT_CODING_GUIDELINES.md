# CRITICAL CODING DIRECTIVES & PROJECT PROPERTIES

This document outlines the mandatory rules for editing the "Kali System: Dispatch" application. This project has a highly specific, non-standard architecture and logic flow. Adherence to these rules is not optional; it is required to prevent breaking the application. **Standard "best practices" or "common solutions" MUST be ignored if they conflict with these directives.**

---

## 1. The Golden Rule: NO Unsolicited Refactoring

This is the most important rule. The codebase, especially `SupplierCard.tsx`, is extremely sensitive.

-   **DO NOT REFACTOR, "CLEAN UP", OR "IMPROVE" CODE** unless specifically asked to do so by the user for a specific function.
-   **ABSOLUTELY PROHIBITED ACTIONS INCLUDE:**
    -   Renaming variables or functions for "clarity."
    -   Extracting JSX into new components.
    -   Changing the internal logic of a function that is not the direct target of the user's request.
    -   Altering file structure.
    -   Changing formatting or "stylistic" code patterns.

**Reasoning:** The application contains highly specific, interconnected logic. Past attempts at general refactoring have consistently broken critical functionality.

---

## 2. Principle of Surgical, Additive Edits

All changes must be minimal, precise, and targeted.

-   **One Task, One Change:** An edit should only address the single, specific feature or bug mentioned in the user's prompt. Do not "bundle" other fixes or improvements.
-   **Additive Changes Preferred:** When possible, add new, isolated functions or components. Avoid modifying the core logic of large, existing functions.
-   **Respect Existing Code:** Do not remove or alter existing functions, state variables, or imports unless the user explicitly asks for their removal. If you see "unused" code, leave it alone.

---

## 3. The Danger Zone: `SupplierCard.tsx`

This file is the source of over 90% of past regressions. It must be handled with extreme caution.

-   When the user asks for a change in `SupplierCard.tsx`, identify the **single function, UI element, or sub-component** related to the request.
-   **Touch ONLY that specific part.** Do not alter any other function, handler, or JSX in the file.
-   If you encounter a type error after an edit, fix the type error locally. Do not use it as an excuse to refactor the surrounding code.

### 3.1 Canonical Design for `SupplierCard`

The design and functionality of the `SupplierCard` component are fixed and must adhere to the user-provided screenshots. The following code snippets represent the single source of truth for its layout and functionality.

#### **A. Overall Structure Snippet**

The component is composed of three main sub-components: `CardHeader`, `OrderItemRow` (mapped), and `CardFooter`.

```jsx
// Simplified structure of the SupplierCard component
<div className="relative rounded-xl ...">
    <CardHeader
        order={order}
        // ... other props
    />
    <div className="flex flex-col ..."> {/* Body */}
        {order.items.map(item => (
            <OrderItemRow
                key={...}
                item={item}
                // ... other props
            />
        ))}
    </div>
    <CardFooter
        order={order}
        // ... other props
    />
</div>
```

#### **B. Header Context Menu Snippet**

The three-dot menu in the header must generate this list of options for an "On the Way" order:

```javascript
// Header Context Menu (for 'On the Way' status)
const options = [
  { label: 'Change Supplier', action: handleChangeSupplier },
  { label: 'Move to Store...', action: handleMoveToStore },
  { label: 'Add a Card...', action: handleAddCard },
  { label: 'Assign to Oudom', action: handleAssignToOudom },
  { label: 'Drop', action: handleDeleteOrder, isDestructive: true },
];
```

#### **C. Item Row Context Menu Snippet**

The three-dot menu on each item row must generate this list of options for an "On the Way" order:

```javascript
// Item Row Context Menu (for 'On the Way' status)
const options = [
  { label: 'Edit Master Item...', action: handleOpenEditMasterItemModal },
  { label: 'Create a variant...', action: handleOpenCreateVariantModal },
  { label: 'Set Unit Price...', action: handleOpenSetUnitPriceModal },
  { label: 'Spoil...', action: handleSpoilItem },
  { label: 'Drop', action: handleDeleteItem, isDestructive: true },
];
```

#### **D. Footer Action Row Snippet**

The footer for an "On the Way" order must contain these specific buttons with these icons and text:

```jsx
// Footer Action Row (for 'On the Way' status)
<div className="px-2 py-1 ... border-t">
    <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
            {/* Add Item Button */}
            <button aria-label="Add Item">
                <svg> {/* Plus Icon */} </svg>
            </button>
            {/* Unsend/Cancel Button */}
            <button aria-label="Unsend">
                <svg> {/* Curved Back Arrow Icon */} </svg>
            </button>
            {/* Telegram Button */}
            <button aria-label="Send to Telegram">
                <svg> {/* Paper Plane Icon */} </svg>
            </button>
        </div>
        {/* Received Button */}
        <button className="bg-green-600 ...">
            Received
        </button>
    </div>
</div>
```

---

## 4. User Interface (UI) and Design Rules

-   **Pixel-Perfect Implementation:** If the user provides a screenshot, the final result must match it exactly, including spacing, alignment, and element placement.
-   **Strictly No Placeholders or Instructions:** Do not add titles, subtitles, instructional text, or placeholders (e.g., "Search...", "Enter name...") to modals or components. The UI must be clean and free of helper text unless explicitly requested.
-   **No Hidden Interactions:** All contextual actions must be accessible via an explicit UI element (e.g., a "three-dot" menu button).
    -   **Right-Click (`onContextMenu`) is forbidden.**
    -   **Long-press actions are forbidden,** with one single exception: a long-press on the main store tabs (`StoreTabs.tsx`) is permitted to copy the manager URL. No other long-press functionality should be implemented.

---

## 5. Technical Implementation Rules

-   **Preserve Alias Imports:** **DO NOT REFACTOR OR REWRITE IMPORT PATHS.** Preserve all alias imports like `@[/...]` as-is. This alias is intentional and will be resolved at runtime. Ignore module resolution errors during static analysis. Do not attempt to "fix" or replace them with relative paths.
-   **File Deletion:** The agent toolset **CANNOT** delete files. If the user asks to delete a file, empty its content and inform the user of this limitation.
-   **SQL & RLS:** When providing SQL, be explicit about its purpose. For Row Level Security, if an `upsert` or `insert` fails, the issue is likely with the `INSERT` policy. Past failures have shown that a single, broad `FOR ALL` policy for authenticated users is the most reliable solution.

---

## 6. Highlighted Cases & Specific Logic to Remember

This section documents unique, non-obvious business logic that must be respected.

-   **Smart "Add to STOCK" Workflow:** When an item is added to a `STOCK` supplier card in the Dispatch view, it **must not** be added directly to the order. Instead, this action **must** trigger the "Create a Variant" modal. This modal will be in a special "stock variant" mode, automatically setting the new variant's supplier to `STOCK` and enabling stock tracking.

-   **AI Parsing Rules:**
    -   **Units:** When parsing a pasted list, if an item is **matched** to an existing database item, the unit from the **database** MUST be used. The AI should be instructed to OMIT the unit field for matched items. If a **new item** is parsed, its unit MUST be normalized to a valid `Unit` enum value (e.g., "pcs" becomes "pc").
    -   **Default Supplier:** When a user pastes a list of items, any item that cannot be matched to an existing one in the database is automatically created and assigned to the **`MARKET`** supplier.

-   **Unique Manager View Workflows (`/?view=manager&store=...`):** The manager view behaves completely differently depending on the store.
    -   **OUDOM View:** This view shows *only* "On the Way" orders for `OUDOM` and `STOCK` suppliers. Cards for the `OUDOM` supplier have a special "OK" -> "DONE" button sequence. Cards for `STOCK` have a standard "Received" button. All other actions are disabled.
    -   **KALI View:** This is not a list of cards but a two-column "To Do" / "Picked Up" report. It groups all orders by their original supplier and allows moving entire groups between states with a checkbox.
    -   **WB/SHANTI View:** This view aggregates all items from all orders and presents a financial report, grouping items by `PISEY` vs. `KALI` suppliers. It is a reporting interface, not an order management one.

-   **Order Message Formatting Rules:**
    -   When sending an order to `SHANTI` store from **any supplier**, the store name line in the message must be specifically formatted as `STOCKO2 (SHANTI)`.
    -   When sending an order for the `P&P` supplier to either `SHANTI` or `WB`, the store name line must be formatted as `STOCKO2 (Store Name)`.

-   **"Completed" Tab Edit Mode:**
    -   A global state `isEditModeEnabled` exists.
    -   This mode is toggled via a context menu on the "Today" header in the "Completed" tab.
    -   When **enabled**, it allows actions on completed orders that are normally disabled: drag-and-drop, changing the payment method, changing the supplier, and editing item quantities.
    -   This mode automatically disables when the user switches tabs or the app loses focus.