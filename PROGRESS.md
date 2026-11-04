# Project progress

ESILV x Capgemini Engineering hackathon: Battery Passport.
Last updated: 4 November 2026.

To run the app and replay the demo, see the [README](README.md).

## Current status

The app reads and writes the team's shared Neo4j database through a small API, and four roles are in place: Battery Manufacturer, Garage, Passport Owner and Sorting Centre. The automated checks never wrote real data to the shared database (see Checks).

| Deliverable | Status |
|---|---|
| Use cases for the three roles, plus Battery Manufacturer | Done |
| README to replay the demo and start from zero in VS Code | Done |
| Neo4j | Connected; full flow on real data still to be confirmed with the group |
| At least 1 of the 6 Défis | Not chosen |
| Summary slides (10-15) | Not done |
| Mockups and/or diagrams | Not done |
| Demo video or URL | Not done |

## Latest changes

In order, on 4 November 2026:

1. **Neo4j connection:** added the API in `server/`, replaced browser storage and the fictional data in `src/data.js` with live data, and removed "Reset demo data".
2. **Module data:** Garage and Passport Owner show the diagnosis, module levels and alerts, with dates shown as month and year where the database has no day.
3. **Lists per garage:** a garage only sees and opens the batteries it has scanned, and a scan first checks that the ID exists in the database.
4. **`WasteRequest`:** Garage requests and Owner approvals moved to the team's queries K and M.
5. **QR scanning:** Garage and Sorting Centre scan with the camera or a photo, using `jsqr`.
6. **VS Code guide:** the README explains how to start from zero on Mac and Windows, and how to fix common errors.
7. **Create battery:** Battery Manufacturer has a form that runs query N and shows the new battery's QR code. It suggests the next free IDs, which replaces the `BP-FR-` generator and "Suggest another". Modules now always appear in order.
8. **Company on manufacturer accounts:** sign-up asks for a company from a list of the companies in Neo4j, and the account is saved locally. The company decides which models and economic operators the form offers. Batteries get no new field, and accounts add nothing to Neo4j.

## What has been done

### Repository

- Linked the folder to `https://github.com/Quuartu/Hackathon.git`, branch `main`.
- Added a `.gitignore` for `.DS_Store`, `node_modules`, `dist` and `.env` files.

### React app

| Role | Device | Features |
|---|---|---|
| Battery Manufacturer | Desktop | Creates a battery in Neo4j and shows its QR code; shows the QR code of a battery it created, or of another battery of its company |
| Garage | Tablet | QR scan (camera or photo) or typed ID, checked against the database, which adds the battery to the account's own list; identification, status, key parameters and history; sends the diagnosis to the Passport Owner |
| Passport Owner | Desktop | Request notifications; Original → Waste status change; table of all batteries with details |
| Sorting Centre | Mobile | QR scan (camera or photo), label or typed ID; "Passport up to date" confirmation if the status is Waste, otherwise a warning; composition and history |

The first screen is login or account creation. Sign-up asks for an email, a password and a role, plus a company for a Battery Manufacturer. After login, each account goes straight to its role and cannot open the others. The 12 test accounts (3 per role) are in `src/accounts.json` and listed in the README.

For team testing, a "Demo mode" button at the top right opens a screen where you choose a role and skip login. It only appears with `npm run dev`, not in production builds.

### Neo4j connection

- The browser calls the API in `server/`, and only the API talks to Neo4j. Credentials are in `db/.env`, which Git ignores.
- `GET /api/batteries` reads all batteries and `GET /api/companies` reads the companies with their operators and models. `POST /api/batteries` creates a battery with query N. `POST /api/batteries/:id/report` and `POST /api/batteries/:id/approve-waste` write the two status steps. An action that no longer applies, or an ID already in use, returns 409.
- The status rules moved from `src/store.js` to the Cypher queries in `server/passport.js`.
- Screens refresh every 5 seconds, so roles stay in sync across browsers and computers.
- Garage requests are `WasteRequest` nodes, following queries K and M in `db/queries.cypher`. The API adds two rules to query K: the battery must be Original, with no request already pending. Queries I and I2 reset them.
- History is built from dates already on the battery, not from separate nodes.
- Accounts stay local and nothing about them is stored in Neo4j. Manufacturer sign-up requires a company chosen from a list of the companies in the database, saved with the local account.
- Battery creation uses query N unchanged. The account's company only decides which models and economic operators the form offers, and the operator is stored through `BUILD` as before.
- Each account's lists of scanned and created batteries are saved in the browser.

### Main files

| File | Contents |
|---|---|
| `src/App.jsx` | Role screens and navigation |
| `src/accounts.json` | Shared test accounts, with plain-text passwords |
| `src/auth.js` | Accounts, password hashing and login sessions |
| `src/store.js` | Loads data from the API, sends battery actions, ID lookup, next free IDs and each account's lists |
| `src/auth.test.js` | Tests for sign-up, login and manufacturer companies |
| `src/store.test.js` | Tests for ID lookup, next free IDs and each account's lists |
| `src/styles.css` | Styles and responsive layout |
| `server/index.js` | API routes and input checks |
| `server/passport.js` | Cypher queries, status rules, checks on new batteries and conversion to the screens' data shape |
| `server/passport.test.js` | Tests for the new battery checks and that conversion |
| `db/` | Team database guide and queries |

## Decisions

| Decision | Reason | Consequence |
|---|---|---|
| API between React and Neo4j, using Node's built-in `http` module and `neo4j-driver` | Database credentials must not reach the browser; a few routes do not need a framework | Two processes to start: `npm run server` and `npm run dev` |
| No fictional data as a fallback | Mock data could hide a broken connection during the demo | If the API or Aura is down, the app shows an error instead of data |
| QR reading with `jsqr`, plus a photo option | The browsers' built-in barcode detector is missing on Chrome for Windows; the photo option also works where the live camera is blocked | The live camera needs `localhost` or HTTPS |
| Accounts and their lists stay local, not in Neo4j | Team choice: the shared database keeps the team's model, with no new fields or nodes for accounts | Lists and created accounts do not follow a user to another browser, computer or port |
| Next free IDs replace the `BP-FR-` generator | The generator made QR codes for batteries that were not in the database, in a different format | QR codes only exist for batteries in the database |
| English interface | Team choice | No French translation |
| Défi postponed | Use cases come first | Still mandatory for the submission |
| Email and password login | Replaces the role picker | Demo only, not real security: checks run in the browser and anyone can sign up with any role |
| Test accounts in a JSON file, not an SQL database | A front-end-only app can read JSON directly, while SQL would need a server or an extra library; a database file in Git also can't be merged | Everyone who clones the repo gets the same accounts, but sign-ups stay in one browser and new shared accounts need a commit |
| Plain-text passwords in `src/accounts.json` | Team choice, so everyone can read and edit the test accounts | Readable by anyone who sees the repo or the app's code; created accounts are still hashed |
| Login session per tab (`sessionStorage`) | Lets each tab stay logged in as a different role during the demo | Closing a tab logs it out |
| JavaScript and Vite, no routing library | Fewer dependencies | No type checking |

## Checks

Neo4j connection, run on 4 November 2026:

- `npm test`: 17 of 17 tests passed.
- `npm run build`: succeeded. An earlier build was searched for credentials and the Neo4j driver, and contained neither.
- `GET /api/batteries` returned the batteries in the shared database.
- The status write queries, and query N, ran inside transactions that were always rolled back. The allowed steps matched; approving without a report or with a wrong request ID, reporting twice, reporting after Waste, approving twice and an unknown ID did not. Query N refused a duplicate ID. The database was unchanged afterwards.
- The text of the create query in `server/passport.js` is identical to query N.
- Invalid requests were refused: wrong content type (415), empty diagnosis, malformed JSON, invalid new battery fields and an unknown model (400), unknown route (404). A battery ID already in use returned 409 from the real database, without creating anything.
- Flows in headless Chrome. Reads came from Neo4j; **POST requests for new data were simulated in the browser and never reached the API**:
  - the Garage request reaches the Passport Owner without a page reload;
  - the Sorting Centre goes from "not up to date" to "up to date";
  - Manufacturer sign-up requires a company, saves it locally and sends nothing about the account to the API;
  - a new battery sends only the fields of query N, and its QR code opens it for a Garage;
  - lists stay separate per account and survive reloads, and logging out and in; a direct URL is blocked for another garage;
  - QR codes read from a photo, a large image and a simulated camera, with clear messages for unknown codes, invalid files and a refused camera;
  - no horizontal scrolling at the widths checked for each flow, and no console errors other than the favicon 404.
- With the API stopped, the app shows a "Data problem" banner.

**Not confirmed:** the whole flow on real data through the screens, including creating a battery with the final code. The database shows that someone on the team approved a request on `BAT-0001` and created `BAT-0002`, but not whether that used the screens. To repeat with the group, following the demo steps in the README, with Abhi resetting afterwards.

Not tested: Windows commands, a real webcam and QR reading from a phone.

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

- Each account's lists are saved in the browser at that address, so they do not follow it to another browser, computer or port. They only limit what the screens show: the API still returns every battery.
- An account created with sign-up only logs in from the browser where it was created.
- The database has no extinguishing agent ("Not recorded" on screen).
- Queries I and I2 only reset `BAT-0001`; other test batteries are deleted with query P.
- Garage and Passport Owner show the diagnosis, module levels and alerts from Neo4j. The module reading history (query F) is not charted yet.
- The API has no login check, because logins still live in the browser. It only accepts connections from the same computer, so it cannot be hosted online as it is.
- The transfer to the sorting centre is only a line in the history: there is no order, carrier or document (that is Défi #2).
- The Garage report is free text. Readings and alerts come from the team's simulator, and new batteries show "No reading" until it updates them.
- The Passport Owner cannot reject a request, because the brief does not include it.

## Next steps

1. Before submitting or sharing the project, change the Neo4j password and remove the real values from `db/.env.example`. The team accepts it being in this public repository for now.
2. Confirm the whole flow on real data with the group, then have Abhi reset the battery (queries I and I2) and delete test batteries (query P).
3. Choose the Défi. The suggestion is #1 (telemetry): an abnormal module resistance would give the demo a concrete reason for the move to Waste.
4. Prepare the slides, mockups or diagrams, and the demo video.

## Stake holders and their needs :  

    Garage Mechanics : Id of battery, statut, key parameters (), history of the battery 

    Responsible of Battery passport and the R&D part : notification of the garage mechanics, being able to modified the statut of the battery, taking data for the feedback 

    Recycler center : All the informations for the recycling part (garage mech data, etc …) 

    Bettery components manufacturers: The campanies that creates all the components of the battery => need to folow each component of the battery and its state 

    The battery owners => they may want to know more about the battery in their vehicles 

    Eureopean union => get the origin of the batteries, apply reglementations,  