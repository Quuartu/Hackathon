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

The first screen is login or account creation. Sign-up asks for an email, a password and a role. After login, each account goes straight to its role and cannot open the others. The 9 test accounts (3 per role) are in `src/accounts.json` and listed in the README. "Reset demo data" on the login page restores the initial battery data.

For team testing, a "Demo mode" button at the top right opens a screen where you choose a role and skip login. It only appears with `npm run dev`, not in production builds.

### Main files

| File | Contents |
|---|---|
| `src/App.jsx` | Role screens and navigation |
| `src/accounts.json` | Shared test accounts, with plain-text passwords |
| `src/auth.js` | Accounts, password hashing and login sessions |
| `src/store.js` | Status change rules and browser storage |
| `src/data.js` | 3 fictional batteries, based on the brief's data model |
| `src/auth.test.js` | Tests for sign-up and login |
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
| Email and password login | Replaces the role picker | Demo only, not real security: checks run in the browser and anyone can sign up with any role |
| Test accounts in a JSON file, not an SQL database | A front-end-only app can read JSON directly, while SQL would need a server or an extra library; a database file in Git also can't be merged | Everyone who clones the repo gets the same accounts, but sign-ups stay in one browser and new shared accounts need a commit |
| Plain-text passwords in `src/accounts.json` | Team choice, so everyone can read and edit the test accounts | Readable by anyone who sees the repo or the app's code; created accounts are still hashed |
| Login session per tab (`sessionStorage`) | Lets each tab stay logged in as a different role during the demo | Closing a tab logs it out |
| JavaScript and Vite, no routing library | Fewer dependencies | No type checking |

## Checks

Run on 4 November 2026:

- `npm test`: 10 of 10 tests passed.
- `npm run build`: succeeded.
- Full flow in headless Chrome, with three tabs sized for tablet, desktop and mobile:
  - the Garage request reaches the Passport Owner without a page reload;
  - the Sorting Centre goes from "not up to date" to "up to date";
  - "Reset demo data" restores the initial data;
  - no horizontal scrolling on the three role screens;
  - the only console error is the favicon 404, which has no effect.
- Login in the same browser:
  - a wrong password, an unknown email and a duplicate email are refused;
  - sign-up and login go straight to the account's role;
  - a URL for another role redirects to the account's own role;
  - the login survives a reload, and a new tab starts logged out;
  - the created account's password is not stored in clear;
  - over plain HTTP on a non-localhost address, file accounts log in and sign-up shows a clear error.
- Demo mode: enters each role without login, switches role while logged in, closes without changes, and is absent from the production build.

Not tested on a real tablet or phone.

## Known limitations

- The transfer to the sorting centre is only a line in the history: there is no order, carrier or document (that is Défi #2).
- The Garage diagnosis is free text: there is no sensor data and there are no alerts (that is Défi #1).
- The Passport Owner cannot reject a request, because the brief does not include it.

## Next steps

1. Choose the Défi. The suggestion is #1 (telemetry): an abnormal module resistance would give the demo a concrete reason for the move to Waste.
2. Decide whether to integrate Neo4j and get the dump mentioned in the brief.
3. Prepare the slides, mockups or diagrams, and the demo video.

## Stake holders and their needs :  

    Garage Mechanics : Id of battery, statut, key parameters (), history of the battery 

    Responsible of Battery passport and the R&D part : notification of the garage mechanics, being able to modified the statut of the battery, taking data for the feedback 

    Recycler center : All the informations for the recycling part (garage mech data, etc …) 

    Bettery components manufacturers: The campanies that creates all the components of the battery => need to folow each component of the battery and its state 

    The battery owners => they may want to know more about the battery in their vehicles 

    Eureopean union => get the origin of the batteries, apply reglementations,  