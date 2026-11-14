---
name: Crew Table
description: A legible operational worksheet for catering plans and quotes.
colors:
  primary: "#245946"
  background: "#f6f5f0"
  surface: "#ffffff"
  text: "#252f32"
  muted: "#596769"
  border: "#d9dfd9"
  soft-green: "#e7efe6"
  table-heading: "#eef1eb"
  editable: "#fff7e6"
  source-note: "#fff2dc"
  source-text: "#735425"
  control-border: "#b9c4bc"
  hover: "#f0f4ee"
  focus: "#e8aa56"
  warning-text: "#9b3724"
  warning-background: "#fff0e8"
  invalid-border: "#b23825"
  invalid-background: "#fff0ec"
typography:
  display:
    fontFamily: "Georgia, serif"
    fontSize: "32px"
    fontWeight: 400
    letterSpacing: "-.025em"
  headline:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    letterSpacing: "-.02em"
  title:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "17px"
    fontWeight: 600
  body:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "15px"
  table:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "14px"
  label:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: ".05em"
  quote-heading:
    fontFamily: "Georgia, serif"
    fontSize: "25px"
    fontWeight: 400
  quote-total:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    letterSpacing: "-.025em"
rounded:
  input: "5px"
  button: "6px"
  table: "8px"
  surface: "12px"
spacing:
  small: "8px"
  control: "14px"
  section: "20px"
  quote: "26px"
  section-gap: "28px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    padding: "10px 14px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.button}"
    padding: "10px 14px"
  button-secondary-hover:
    backgroundColor: "{colors.hover}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.input}"
    padding: "9px"
  input-editable:
    backgroundColor: "{colors.editable}"
    textColor: "{colors.text}"
    rounded: "{rounded.input}"
    padding: "9px"
  quote:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.surface}"
    padding: "26px"
---

# Design System: Crew Table

## Overview

An operational catering worksheet: legible controls, dense but orderly tables, and a prominent live quote. The user's easy-calculator requirement governs the interface. This document records the implemented interface; no external visual comp was approved.

**Key Characteristics:**

- Direct phase and worker-group editing.
- Restrained forest-green actions on warm paper.
- Conventional inputs with visible keyboard focus.
- Tabular numeric outputs and a single live quote.

## Colors

### Primary

Forest green identifies primary actions, selected phases, active navigation, links, and selling-price totals. Soft green highlights profit and selected-plan context.

### Neutral

Warm paper frames white working surfaces. Charcoal carries primary text; muted grey carries labels and explanatory copy. Fine borders separate rows and surfaces. Pale green table headings distinguish labels without heavy framing.

Amber shopping inputs identify editable pack quantities, prices, and yields. Warm source notes distinguish assumptions and provenance. Warnings and invalid controls use separate red-toned treatments. Amber outlines mark focus independently of selection.

## Typography

Arial with Helvetica and sans-serif fallbacks provides the operational text. Georgia adds modest emphasis to the editable event name and quote heading. Event names reduce to 28px at the 1050px breakpoint. Table headings are uppercase and letter-spaced; general form labels remain sentence case.

Tables use the table role, with shopping rows at 13px. Supporting notes are 11 to 13px. Paragraphs use a 1.55 line height; notes use 1.5. Number inputs, monetary outputs, and numeric table cells use tabular numerals. Numeric table columns align right.

## Layout

The desktop workspace has a maximum width of 1550px, a flexible main column and a 320px quote column, with a 36px gap and 38px 4% 80px padding. Above 1300px, the gap grows to 48px. At 1050px and below, the quote column is 280px, the gap is 20px, and padding is 28px 3%.

At 800px and below, the main content and quote stack vertically in document order with 25px spacing and 25px 5% workspace padding. The quote becomes static. The header wraps; navigation and dense table wrappers scroll horizontally. Phase buttons retain all three choices and stack their label and summary. Cost fields change from three columns to two. Print quote remains visible on mobile.

Four task tabs organize Event plan, Menu & recipes, Costs & margin, and Shopping list. The desktop quote is sticky with a 24px top offset. Print output removes navigation and actions, shows the quote in normal flow, and avoids splitting the quote and comparison sections.

## Elevation & Depth

The interface is flat. White surfaces, pale fills, and fine borders provide separation; there are no ambient or raised-card shadows. The active navigation underline is an inset shadow used as a state marker. Toast feedback fades over 0.2 seconds; other controls change state directly.

## Shapes

Inputs have compact rounded corners; buttons are slightly softer. Table wrappers and phase selectors share the table radius. The quote uses the larger surface radius. Borders are one pixel. Checkboxes retain familiar native control shapes with green accents. No imagery is required.

## Components

### Buttons

Primary export uses forest green and white text. Secondary actions use white surfaces and fine borders, changing to pale green with a green border on hover. Compact actions use 13px text and 7px 10px padding. Disabled buttons reduce opacity to 0.5. Buttons and links receive a 3px amber focus-visible outline with a 2px offset.

### Inputs / Fields

Standard fields use white backgrounds and control borders; shopping quantity, price, and yield fields use amber backgrounds. Invalid fields use the invalid border and background tokens. Inputs and selects use the same focus outline. Editable names are visually quieter until hover. Number inputs are normally 90px wide; specialized compact fields differ by context.

### Navigation

Task navigation is a horizontal row of text buttons with 14px text and a bottom rule. The active tab uses green text and a 3px inset underline. Phase selectors are equally sized outlined buttons; the selected phase uses a solid green surface and white text. Selection is also communicated through aria-current or aria-pressed.

### Tables and quote

Tables are white, bordered, horizontally scrollable working surfaces. Header and body cells normally use 13px 14px padding. Group rows show four columns: name, headcount, meal package, and per-person daily price. Individual meal checkboxes appear only for custom packages. Group extras and removal, package comparison, cost breakdown, overheads, and source detail use collapsed native disclosures. Disclosure state survives input edits. The quote card uses 26px padding, reducing to 20px below 1050px. A serif heading and green selling-price total establish the hierarchy; cost and profit remain compact rows. Plan backup and import live in the Plan files menu.

### Source notes and feedback

Source notes use warm fills and brown text. Warnings use warm red fills. The dark toast sits centered near the viewport bottom and exposes a status role. Browser-local saving and price assumptions remain visible in copy.

## Do's and Don'ts

### Do:

- Do keep phase and group controls directly editable.
- Do keep one live quote always in view: the quote pill in the top bar opens the full breakdown on every editing screen (it replaced the side panel so wide tables get the full width).
- Do align monetary columns and use tabular numerals.
- Do retain labels, visible focus, and independent table scrolling.
- Do distinguish editable assumptions from sourced prices.

### Don't:

- Don't replace the operational workspace with a marketing hero.
- Don't imply that browser-local plans are cloud-synced.
- Don't imply that supplier prices update live.
- Don't use decoration that competes with inputs and quote totals.

## Dashboard overview

Dashboard is the default entry point. A full-width summary shows quote, cost and profit, followed by Build / Live / Break columns with editable day counts and direct crew editor buttons. Cost composition and menu/shopping shortcuts follow below. The quote sidebar appears only in the editing sections. On narrow screens, phase columns stack. Existing detailed inputs remain available in Days & crew, Menu & recipes, Costs & margin, and Shopping list.
