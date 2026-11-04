# Project progress

ESILV x Capgemini Engineering hackathon: Battery Passport.
Last updated: 4 November 2026.

To run the app and replay the demo, see the [README](README.md).

## Current status

The three-role flow from the brief ("Cas d'utilisation par utilisateurs clés") works end to end, using fictional data.

| Deliverable | Status |
|---|---|
| Use cases for the three roles | Done |
| README to replay the demo | Done |
| Neo4j | Not done, the app uses fictional data |
| At least 1 of the 6 Défis | Not chosen |
| Summary slides (10-15) | Not done |
| Mockups and/or diagrams | Not done |
| Demo video or URL | Not done |

## What has been done

### Repository

- Linked the folder to `https://github.com/Quuartu/Hackathon.git`, branch `main`.
- Added a `.gitignore` for `.DS_Store`, `node_modules` and `dist`.

### React app

| Role | Device | Features |
|---|---|---|
| Garage | Tablet | Simulated scan; identification, status, key parameters and history; sends the diagnosis to the Passport Owner |
| Passport Owner | Desktop | Request notifications; Original → Waste status change; table of all batteries with details |
| Sorting Centre | Mobile | Simulated scan; "Passport up to date" confirmation if the status is Waste, otherwise a warning; composition and history |

The home page lets you choose a role and restore the initial data with "Reset demo data".

### Main files

| File | Contents |
|---|---|
| `src/App.jsx` | Role screens and navigation |
| `src/store.js` | Status change rules and browser storage |
| `src/data.js` | 3 fictional batteries, based on the brief's data model |
| `src/store.test.js` | Tests for the status change rules and ID lookup |
| `src/styles.css` | Styles and responsive layout |

## Decisions

| Decision | Reason | Consequence |
|---|---|---|
| Fictional data only, no Neo4j | Team choice; the dump and Neo4j were not available on this Mac | The brief asks for Neo4j, so this requirement is still open |
| Simulated QR scan | Simplest option for a web app | No real QR codes or camera: you click a label or enter an ID |
| English interface | Team choice | No French translation |
| Défi postponed | Use cases come first | Still mandatory for the submission |
| Sync through `localStorage` | No backend needed | Roles only update across tabs of the same browser, so the demo must run on one computer |
| Role picker with no login | Enough for the demo | No accounts and no access control |
| JavaScript and Vite, no routing library | Fewer dependencies | No type checking |

## Checks

Run on 4 November 2026:

- `npm test`: 4 of 4 tests passed.
- `npm run build`: succeeded.
- Full flow in headless Chrome, with three tabs sized for tablet, desktop and mobile:
  - the Garage request reaches the Passport Owner without a page reload;
  - the Sorting Centre goes from "not up to date" to "up to date";
  - the status survives a reload, and "Reset demo data" restores it;
  - no horizontal scrolling on the three role screens;
  - the only console error is the favicon 404, which has no effect.

Not tested on a real tablet or phone.

## Known limitations

- The transfer to the sorting centre is only a line in the history: there is no order, carrier or document (that is Défi #2).
- The Garage diagnosis is free text: there is no sensor data and there are no alerts (that is Défi #1).
- The Passport Owner cannot reject a request, because the brief does not include it.

## Next steps

1. Choose the Défi. The suggestion is #1 (telemetry): an abnormal module resistance would give the demo a concrete reason for the move to Waste.
2. Decide whether to integrate Neo4j and get the dump mentioned in the brief.
3. Prepare the slides, mockups or diagrams, and the demo video.
