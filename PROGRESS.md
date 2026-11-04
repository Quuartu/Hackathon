# Project progress

ESILV x Capgemini Engineering hackathon: Battery Passport.
Last updated: 4 November 2026.

To run the app and replay the demo, see the [README](README.md).

## Current status

The app reads its data from the team's shared Neo4j database through a small API. A real write from the screens has not been run yet, because it changes the shared database (see Checks).

| Deliverable | Status |
|---|---|
| Use cases for the three roles | Done |
| README to replay the demo | Done |
| Neo4j | Connected; first real write still to run with the group |
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

The first screen is login or account creation. Sign-up asks for an email, a password and a role. After login, each account goes straight to its role and cannot open the others. The 12 test accounts (3 per role) are in `src/accounts.json` and listed in the README.

For team testing, a "Demo mode" button at the top right opens a screen where you choose a role and skip login. It only appears with `npm run dev`, not in production builds.

### Neo4j connection

- The browser calls the API in `server/`, and only the API talks to Neo4j. Credentials are in `db/.env`, which Git ignores.
- `GET /api/batteries` reads all batteries. `POST /api/batteries/:id/report` and `POST /api/batteries/:id/approve-waste` write the two status steps. An action that no longer applies returns 409.
- The status rules moved from `src/store.js` to the Cypher queries in `server/passport.js`.
- Screens refresh every 5 seconds, so roles stay in sync across browsers and computers.
- The Garage request is stored in two new `BatteryInstance` properties, `reportedReason` and `reportedAt`. Query I in `db/queries.cypher` now removes them too.
- History is built from dates already on the battery, not from separate nodes.

### Main files

| File | Contents |
|---|---|
| `src/App.jsx` | Role screens and navigation |
| `src/accounts.json` | Shared test accounts, with plain-text passwords |
| `src/auth.js` | Accounts, password hashing and login sessions |
| `src/store.js` | Loads data from the API, sends the status actions, ID lookup and generation |
| `src/auth.test.js` | Tests for sign-up and login |
| `src/store.test.js` | Tests for ID lookup and generation |
| `src/styles.css` | Styles and responsive layout |
| `server/index.js` | API routes and input checks |
| `server/passport.js` | Cypher queries, status rules and conversion to the screens' data shape |
| `server/passport.test.js` | Tests for that conversion |
| `db/` | Team database guide and queries |

## Decisions

| Decision | Reason | Consequence |
|---|---|---|
| API between React and Neo4j, using Node's built-in `http` module and `neo4j-driver` | Database credentials must not reach the browser; three routes do not need a framework | Two processes to start: `npm run server` and `npm run dev` |
| No fictional data as a fallback | Mock data could hide a broken connection during the demo | If the API or Aura is down, the app shows an error instead of data |
| Simulated QR scan | Simplest option for a web app | No real QR codes or camera: you click a label or enter an ID |
| English interface | Team choice | No French translation |
| Défi postponed | Use cases come first | Still mandatory for the submission |
| Email and password login | Replaces the role picker | Demo only, not real security: checks run in the browser and anyone can sign up with any role |
| Test accounts in a JSON file, not an SQL database | A front-end-only app can read JSON directly, while SQL would need a server or an extra library; a database file in Git also can't be merged | Everyone who clones the repo gets the same accounts, but sign-ups stay in one browser and new shared accounts need a commit |
| Plain-text passwords in `src/accounts.json` | Team choice, so everyone can read and edit the test accounts | Readable by anyone who sees the repo or the app's code; created accounts are still hashed |
| Login session per tab (`sessionStorage`) | Lets each tab stay logged in as a different role during the demo | Closing a tab logs it out |
| JavaScript and Vite, no routing library | Fewer dependencies | No type checking |

## Checks

Neo4j connection, run on 4 November 2026:

- `npm test`: 11 of 11 tests passed.
- `npm run build`: succeeded, and the bundle contains no credentials or Neo4j driver.
- `GET /api/batteries` returned `BAT-0001` from the shared database.
- The real write queries ran inside a transaction that was always rolled back. The allowed steps matched; approving without a report, reporting twice, reporting after Waste, approving twice and an unknown ID did not. The database was unchanged afterwards.
- Invalid requests were refused: wrong content type (415), empty diagnosis and malformed JSON (400), unknown route (404).
- Full flow in headless Chrome, with three tabs sized for tablet, desktop and mobile. Reads came from Neo4j; **the two POST requests were simulated in the browser and never reached the API**:
  - the Garage request reaches the Passport Owner without a page reload;
  - the Sorting Centre goes from "not up to date" to "up to date";
  - no horizontal scrolling on the three role screens;
  - no console errors other than the favicon 404.
- With the API stopped, the app shows a "Data problem" banner.

**Not yet tested:** the two POST routes committing a real change to Neo4j. To run with the group, following the demo steps in the README, with Abhi resetting afterwards.

Earlier checks, run on 4 November 2026 before the Neo4j connection:

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

- The database holds one battery and no extinguishing agent ("Not recorded" on screen).
- The module gauges and alerts in the team guide (queries D and E) are not shown yet.
- The API has no login check, because logins still live in the browser. It only accepts connections from the same computer, so it cannot be hosted online as it is.
- Generated passport IDs use `BP-FR-XXXXXX` and are not saved, while the database uses `BP-2027-0001`.
- The transfer to the sorting centre is only a line in the history: there is no order, carrier or document (that is Défi #2).
- The Garage diagnosis is free text: there is no sensor data and there are no alerts (that is Défi #1).
- The Passport Owner cannot reject a request, because the brief does not include it.

## Next steps

1. Change the Neo4j password and remove the real values from `db/.env.example`: it was committed to this public repository.
2. Run the first real write with the group, then have Abhi reset the battery.
3. Choose the Défi. The suggestion is #1 (telemetry): an abnormal module resistance would give the demo a concrete reason for the move to Waste.
4. Prepare the slides, mockups or diagrams, and the demo video.

## Stake holders and their needs :  

    Garage Mechanics : Id of battery, statut, key parameters (), history of the battery 

    Responsible of Battery passport and the R&D part : notification of the garage mechanics, being able to modified the statut of the battery, taking data for the feedback 

    Recycler center : All the informations for the recycling part (garage mech data, etc …) 

    Bettery components manufacturers: The campanies that creates all the components of the battery => need to folow each component of the battery and its state 

    The battery owners => they may want to know more about the battery in their vehicles 

    Eureopean union => get the origin of the batteries, apply reglementations,  