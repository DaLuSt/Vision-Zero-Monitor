# Accessibility review checklist: screen reader

A manual check that Vision Zero Monitor can be used with a screen reader. It complements the
automated checks that run on every pull request:

* `e2e/a11y.spec.ts`: axe (WCAG 2.1 A/AA) on all 12 pages, light and dark, desktop and mobile;
  a distinct title per page; chart and heading names that read correctly.
* `e2e/keyboard.spec.ts`: skip link, navigation with Tab and Enter, a visible focus indicator on
  every tab stop, no keyboard traps, chart builder and legislation filters by keyboard.

Automated tools cannot tell whether what a screen reader announces makes sense. That is what
this checklist is for.

**Who:** ideally someone who uses a screen reader regularly; otherwise anyone after 15 minutes
with the screen reader's basic commands. **Time:** about 45 minutes. **When:** before
presenting the site as accessible, and after a change to navigation, charts or tables.

## Setup (pick one)

| Screen reader | Browser | Basic commands |
| --- | --- | --- |
| NVDA (Windows, free) | Firefox or Chrome | `H` next heading, `D` next landmark, `T` next table, `Ctrl+Alt+arrows` move in a table, `Insert+F7` list of headings and links |
| VoiceOver (macOS) | Safari | `VO` = `Ctrl+Option`; `VO+Cmd+H` next heading, `VO+U` rotor (headings, landmarks, links), `VO+arrows` move in a table |
| VoiceOver (iPhone) | Safari | Rotor (two-finger turn) to Headings, then swipe down; double-tap to activate |

Site: <https://dalust.github.io/Vision-Zero-Monitor/>

## How to use it

1. Note the review details below.
2. Work through the rows in order. Each row says what to do and what you should hear.
3. Tick ✅ when it works as described, ❌ when it does not, and note what you heard.
4. Any ❌: open an issue on GitHub with the row number, screen reader, browser and what you
   heard.

| Review detail | Value |
| --- | --- |
| Reviewer | |
| Date | |
| Screen reader and version | |
| Browser and version, device | |

## A. Every page

| # | Do | Expect | Result |
| --- | --- | --- | --- |
| A1 | Open the site and listen to the page title | “Overview · Vision Zero Monitor” | ☐ |
| A2 | Press Tab once, then Enter | “Skip to content”; focus moves to the main content | ☐ |
| A3 | List the landmarks | Banner, navigation “Main”, main, content info (footer) | ☐ |
| A4 | Open “Road users” from the main navigation | The new page title “Road users · Vision Zero Monitor” is announced, or is read when you ask for it | ☐ |
| A5 | List the headings on the overview | One level-1 heading “Vision Zero Monitor”, then level-2 “Key figures for the European Union”, “EU road fatalities over time”, “Data freshness” | ☐ |
| A6 | Switch your system to dark mode and repeat A5 | Same result | ☐ |

## B. Figures and charts

| # | Do | Expect | Result |
| --- | --- | --- | --- |
| B1 | Overview: move to the chart | A figure named “Road deaths, European Union (27), 1999–2024”, with a short text summary of the trend as its description | ☐ |
| B2 | Under the chart, open “Show data table” | A table with years and values; column headers are read as you move across | ☐ |
| B3 | Road users (any country): move to the first bar chart | A figure named like “Road deaths by road user: Netherlands : 2024 · 566 deaths”: title and subtitle with a pause between them, not run together | ☐ |
| B4 | In that section, move to the table next to the chart | Category, latest year, share, 2019 and change, with each category as a row header | ☐ |
| B5 | Note how the chart itself is announced (Recharts exposes it as an interactive “application”) | Record what you hear; if it is confusing or traps the virtual cursor, ❌ and describe it | ☐ |

## C. Interactive pages

| # | Do | Expect | Result |
| --- | --- | --- | --- |
| C1 | Chart builder: find the “Geographies” group and tick “Netherlands” | Checkbox announced with its name and state; the chart updates | ☐ |
| C2 | Chart builder: choose the measure “per million” | Buttons announced as toggle buttons with pressed/not pressed | ☐ |
| C3 | Legislation: type “2015/413” in “Search” | The field is announced as “Search”; the list of acts updates | ☐ |
| C4 | Legislation: listen to the heading of an act | “[citation] official text on EUR-Lex (external)”, with the citation read once | ☐ |
| C5 | Legislation: open an act's details and its timeline | The timeline is a list named “Timeline of …”; upcoming steps are marked as upcoming | ☐ |
| C6 | Data explorer: change a filter | The number of rows or an updated table is announced, or is easy to find | ☐ |
| C7 | Commitments: move to a national strategy, e.g. Spain | The Spanish quote is read with Spanish pronunciation, then “Official English translation” and the English text | ☐ |
| C8 | Country page (Netherlands): list the headings | “Netherlands”, “Who dies on the roads in the Netherlands”, “Commitments covering the Netherlands”, “Upcoming EU transposition deadlines”, “Data availability and sources” | ☐ |

## D. Downloads and links

| # | Do | Expect | Result |
| --- | --- | --- | --- |
| D1 | Road users: move to the “CSV” button of a section | “CSV of deaths by road user in [country]” | ☐ |
| D2 | Road users, “Over time” chart: move to the “PNG” button | “PNG image of [chart title]” | ☐ |
| D3 | Header: move to the GitHub link | “GitHub repository (external)” | ☐ |

## After the review

Record the date, reviewer and screen reader in `docs/IMPLEMENTATION_PLAN.md` (Milestone 5)
and close issue #16 when every row is ✅ or has its own issue.
