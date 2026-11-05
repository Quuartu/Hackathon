# Project progress

ESILV x Capgemini Engineering hackathon: Battery Passport.
Last updated: 5 November 2026.

To run the app and replay the demo, see the [README](README.md).

## Current status

The app reads and writes the team's shared Neo4j database through a small API, keeps accounts in MongoDB, and four roles are in place: Battery Manufacturer, Garage, Customer and Sorting Centre. The automated checks never wrote real data to the shared Neo4j database (see Checks).

| Deliverable | Status |
|---|---|
| Use cases of the brief's three roles, with Battery Manufacturer covering the Passport Owner | Done |
| README to replay the demo and start from zero in VS Code | Done |
| Neo4j | Connected; full flow on real data still to be confirmed with the group |
| MongoDB accounts | Done: test accounts are loaded on the team's Atlas cluster, and login and lists work there; still to try from the network used for the demo |
| At least 1 of the 6 Défis | #1 (telemetry) in progress: data reaches the app; the write to Neo4j has only run in a rolled-back transaction; a real sensor or simulator through ngrok is still to be tested |
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
9. **New roles:** Passport Owner became a read-only Customer. Battery Manufacturer now also receives garage requests, approves Waste and lists all its company's batteries with details and QR codes. Sorting Centre, like Garage and Customer, only sees the batteries it has scanned.
10. **Telemetry (by Malo):** the API receives module readings as JSON, also through ngrok, and holds them for review. Garage and Battery Manufacturer compare them with the database and write them to Neo4j with **Update values**.
11. **Telemetry fixes after review:** the overall resistance increase is now updated; the diagnosis and `Reading` property names match the team's emulator; missing or impossible readings are refused instead of counting as `OK`; the API listens on this computer only; through ngrok only telemetry routes are available, and only they allow other websites; the apply route needs JSON; `POST /api/telemetry/apply`, which wrote readings without review, is removed; the simulate button is left out of production builds; and the texts are in English.

On 5 November 2026:

12. **Accounts in MongoDB:** accounts and scanned lists moved from the browser to MongoDB, so they follow a user to any computer. The API now owns sign-up and login, with passwords hashed using `scrypt`. Actions that change battery data need a login with the right role. `src/accounts.json` is gone: `npm run seed-accounts` loads the same 12 test accounts. Demo mode logs in with a role's first test account, so the API has no way around its checks.
13. **Batteries identified by passport ID:** scanning or typing only accepts a passport ID such as `BP-2027-0002`, and the API refuses anything else. Screens, addresses and the lists in MongoDB use it too. `BAT-0002` remains the battery's key in Neo4j, for the battery routes and telemetry, and appears as a detail on screen.
14. **BMS emulator (by Abhi):** it simulates the modules' internal resistance, with a control panel, and lives on the `emulator` branch, not on `main`. It writes directly to Neo4j, so its readings skip the app's **Update values** review. It was not run for the checks below.
15. **Telemetry by passport ID:** `POST /api/telemetry` now needs `batteryPassportId`, in the JSON or the URL. A request with only a `batteryId`, or with no ID, gets a 400, and an unknown passport gets a 404. Readings with no ID no longer go to `BAT-0001`, which also sent readings carrying a passport ID to the wrong battery.
16. **Review against the brief:** the Garage screen now opens with a banner when a module is `CRITICAL`, asking to report the battery. Modules show the manufacturer's limit and the time of the latest reading. The history no longer says "Transfer to sorting centre organised", because no transfer exists. `db/schema.cypher` recreates the demo data on a new instance, and the README has the alert rules and a test scenario.
17. **ngrok over HTTP:** `npm run ngrok` now opens both `http://` and `https://`, for senders that cannot use HTTPS. The API did not change. `--scheme` is deprecated by ngrok but still works in agent 3.39.13. It has not been run with a real ngrok account.

## What has been done

### Repository

- Linked the folder to `https://github.com/Quuartu/Hackathon.git`, branch `main`.
- Added a `.gitignore` for `.DS_Store`, `node_modules`, `dist` and `.env` files.

### React app

| Role | Device | Features |
|---|---|---|
| Battery Manufacturer | Desktop | Creates batteries in Neo4j; garage request notifications; Original → Waste status change; table of its company's batteries, with details and QR codes |
| Garage | Tablet | QR scan (camera or photo) or typed ID, checked against the database, which adds the battery to the account's own list; identification, status, key parameters and history; sends the diagnosis to the manufacturer |
| Customer | Mobile | QR scan (camera or photo) or typed ID, with its own list; read-only status, key parameters and history |
| Sorting Centre | Mobile | QR scan (camera or photo) or typed ID, with its own list; "Passport up to date" confirmation if the status is Waste, otherwise a warning; composition and history |

The first screen is login or account creation. Sign-up asks for an email, a password and a role, plus a company for a Battery Manufacturer. After login, each account goes straight to its role and cannot open the others. The 12 test accounts (3 per role) are in MongoDB and listed in the README.

For team testing, a "Demo mode" button at the top right opens a screen where you choose a role and enter with its first test account. It only appears with `npm run dev`, not in production builds.

### MongoDB accounts

Database `battery_passport`, collection `accounts`, one document per account, with a unique index on `email`:

```js
{
  email: "garage1@demo.example",
  passwordHash: "salt:hash",
  role: "garage",
  company: null,          // manufacturer only
  batteries: [{ passportId: "BP-2027-0001", at: "2026-11-05T09:00:00.000Z" }]   // garage, customer, sorting; newest first
}
```

Only battery IDs are stored here, and battery data stays in Neo4j. An ID no longer in Neo4j is ignored.

| Route | Purpose | Who |
|---|---|---|
| `POST /api/auth/signup`, `POST /api/auth/login` | Create an account or log in; both return a token | Anyone |
| `POST /api/auth/logout` | End the session | Logged in |
| `GET /api/me` | Account and its list of scanned batteries | Logged in |
| `POST /api/me/batteries` | Add a scan to the list | Garage, Customer, Sorting Centre |
| `POST /api/batteries` | Create a battery | Battery Manufacturer |
| `POST /api/batteries/:id/report` | Report out of service | Garage |
| `POST /api/batteries/:id/approve-waste` | Change the status to Waste | Battery Manufacturer |
| `POST /api/batteries/:id/apply-telemetry` | Write pending readings to Neo4j | Garage, Battery Manufacturer |

Reading batteries and companies, and sending telemetry, need no login. Through ngrok only the telemetry routes answer, so accounts are not reachable there.

### Neo4j connection

- The browser calls the API in `server/`, and only the API talks to Neo4j. Credentials are in `db/.env`, which Git ignores.
- `POST /api/telemetry` holds module readings for review in memory, and `POST /api/batteries/:id/apply-telemetry` writes them to Neo4j.
- `GET /api/batteries` reads all batteries and `GET /api/companies` reads the companies with their operators and models. `POST /api/batteries` creates a battery with query N. `POST /api/batteries/:id/report` and `POST /api/batteries/:id/approve-waste` write the two status steps. An action that no longer applies, or an ID already in use, returns 409.
- The status rules moved from `src/store.js` to the Cypher queries in `server/passport.js`.
- Screens refresh every 5 seconds, so roles stay in sync across browsers and computers.
- Garage requests are `WasteRequest` nodes, following queries K and M in `db/queries.cypher`. The API adds two rules to query K: the battery must be Original, with no request already pending. Queries I and I2 reset them.
- History is built from dates already on the battery, not from separate nodes.
- Nothing about accounts is stored in Neo4j. Manufacturer sign-up requires a company from the list in Neo4j, which the API checks and saves with the account in MongoDB.
- Battery creation uses query N unchanged. The account's company only decides which models and economic operators the form offers, and the operator is stored through `BUILD` as before.

### Main files

| File | Contents |
|---|---|
| `src/App.jsx` | Role screens and navigation |
| `src/auth.js` | Login, sign-up and the tab's session, through the API |
| `src/store.js` | Loads data from the API, sends battery actions, ID lookup, next free IDs and the account's list |
| `src/store.test.js` | Tests for ID lookup and next free IDs |
| `src/styles.css` | Styles and responsive layout |
| `server/index.js` | API routes, sessions, role checks and input checks |
| `server/accounts.js` | Password hashing, sign-up and login checks, who may call each route, and the test accounts |
| `server/accounts.test.js` | Tests for those rules |
| `server/seed-accounts.js` | Loads the test accounts into MongoDB and creates the email index |
| `server/passport.js` | Cypher queries, status rules, checks on new batteries and conversion to the screens' data shape |
| `server/passport.test.js` | Tests for the new battery checks and that conversion |
| `db/` | Team database guide, queries and `schema.cypher`, the demo data for a new instance |

## Decisions

| Decision | Reason | Consequence |
|---|---|---|
| API between React and Neo4j, using Node's built-in `http` module and `neo4j-driver` | Database credentials must not reach the browser; a few routes do not need a framework | Two processes to start: `npm run server` and `npm run dev` |
| No fictional data as a fallback | Mock data could hide a broken connection during the demo | If the API or Aura is down, the app shows an error instead of data |
| QR reading with `jsqr`, plus a photo option | The browsers' built-in barcode detector is missing on Chrome for Windows; the photo option also works where the live camera is blocked | The live camera needs `localhost` or HTTPS |
| Battery Manufacturer covers the brief's Passport Owner, and Passport Owner becomes a Customer | Team choice: whoever puts a battery on the market is responsible for its passport, and the customer only consults it | The slides must explain this, because the brief names a Passport Owner role |
| Accounts and their lists in MongoDB, batteries in Neo4j | Team choice: accounts follow a user to any computer, and the graph keeps the team's model with no fields or nodes for accounts | A second database to run: if MongoDB is unreachable, nobody can log in |
| Sessions as a token in `sessionStorage`, kept in the API's memory | Each tab can stay logged in as a different role during the demo, which a cookie would not allow | Restarting the API logs everyone out; closing a tab logs it out |
| Passport ID is the only way to find a battery | Team choice: one identifier, the same one the QR code holds | Telemetry and the battery routes still use the battery ID, because that is the key in Neo4j |
| API checks the role on actions that change battery data | Login now runs on the server, so this takes a few lines | Checks the role only, not the company, until there is a second company |
| Next free IDs replace the `BP-FR-` generator | The generator made QR codes for batteries that were not in the database, in a different format | QR codes only exist for batteries in the database |
| English interface | Team choice | No French translation |
| Défi #1 (telemetry), with a person confirming each update | New readings can be compared before they change the shared database | Readings stay in memory until someone clicks **Update values** |
| Email and password login | Replaces the role picker | Demo only, not real security: anyone can sign up with any role |
| JavaScript and Vite, no routing library | Fewer dependencies | No type checking |

## Checks

MongoDB accounts, run on 5 November 2026 on a temporary local MongoDB unless stated. Neo4j was the real one, read only:

- `npm test` and `npm run build` pass, and the build contains no connection strings.
- The test accounts load, and loading them twice changes nothing.
- Each role can only call its own routes (401 without login, 403 with the wrong role).
- An operator such as `{"$ne": null}` in the login email is refused. Requests carrying ngrok's header cannot reach the account routes.
- Flows in headless Chrome: a wrong password shows an error; the list appears after login, survives a reload and reaches a separate browser profile; scans made in one profile appear in the other; a direct URL to an unscanned battery is blocked; the next account in a tab does not inherit the list; sign-up works and the account logs in from another profile; an expired session returns to login; Demo mode enters and switches roles. No console errors.
- With MongoDB stopped while logged in, the banner names MongoDB after about 10 seconds, and the batteries stay on screen.

- The API recovers without a restart if MongoDB is off when it starts, or drops and comes back.
- On the team's Atlas cluster, in headless Chrome: the 12 test accounts are loaded; login, a scan saved and seen from a second browser profile, a manufacturer with its company, Demo mode and sign-up all work. The test account and scans were removed afterwards.
- The commit was installed, tested and built from a clean clone, with the team's `main` included, and the checks below ran from that clone.
- Passport ID, on Atlas: `BAT-0002` is refused by the field and by the API, and nothing is saved; a passport ID opens the battery and joins the list; an old address with `BAT-0002` shows "Battery not found"; a QR code made by the app and read back as a photo opens the right battery.
- Write routes on the real Neo4j, with a battery that does not exist, so the queries run and change nothing: an allowed role reaches the database for report, approval, creation and telemetry update, and a wrong role gets 403. All batteries were identical before and after.

- Telemetry by passport ID, on the real API: the old `batteryId` format, no ID, an unknown passport and a battery ID in the passport field are refused and nothing waits for review; `BP-2027-0003` lands on `BAT-0003`; the URL form works in lowercase and with ngrok's header, and the other routes stay closed to that header. The manufacturer's screen shows the readings with **Update values**, and **Simulate telemetry** works. The **Update values** query found the battery in a transaction that was rolled back, and all batteries were identical afterwards.

Review against the brief, run on 5 November 2026 on the real API and Neo4j. Critical modules were simulated in the browser only, and write requests were blocked:

- `npm test` (20 of 20) and `npm run build` pass.
- Garage: the banner appears with a critical module, and not once the request is sent, with healthy modules or on a Waste battery. Battery Manufacturer shows the limit and the latest reading from Neo4j. Customer and Sorting Centre still open. No horizontal scrolling at the widths checked (Garage 820 and 390 px, Manufacturer 1280, Sorting and Customer 390), and no page errors.
- `db/schema.cypher`: the Neo4j server accepted the four constraints without running them. With test IDs, in a transaction that was rolled back, the data statement created 21 nodes that the app's list query reads correctly. The database had 144 nodes before and after, and the model's values match the shared database. It has not been run on an empty instance.

**Not confirmed:**

- A report, approval or battery creation that really changes data with the new checks, or clicked through the screens. To do with the group, because it changes the shared database. Neo4j shows that readings of 2 mΩ reached `BAT-0001` on 5 November at 10:57 UTC, so someone seems to have used **Update values**, but this was not observed.
- Atlas from the network used for the demo, and from any computer other than this one.
- Scanning with a real camera.
- ngrok itself, and the PowerShell command in the README, which was not run on Windows; the same JSON was sent another way.

Neo4j connection, run on 4 November 2026:

- `npm test`: 20 of 20 tests passed.
- The telemetry write ran inside a transaction that was always rolled back, with the database unchanged afterwards. Requests carrying ngrok's header reached only the telemetry routes in a local test. **ngrok itself and a real simulator have not been tested.**
- `npm run build`: succeeded. An earlier build was searched for credentials and the Neo4j driver, and contained neither.
- `GET /api/batteries` returned the batteries in the shared database.
- The status write queries, and query N, ran inside transactions that were always rolled back. The allowed steps matched; approving without a report or with a wrong request ID, reporting twice, reporting after Waste, approving twice and an unknown ID did not. Query N refused a duplicate ID. The database was unchanged afterwards.
- The text of the create query in `server/passport.js` is identical to query N.
- Invalid requests were refused: wrong content type (415), empty diagnosis, malformed JSON, invalid new battery fields and an unknown model (400), unknown route (404). A battery ID already in use returned 409 from the real database, without creating anything.
- Flows in headless Chrome. Reads came from Neo4j; **POST requests for new data were simulated in the browser and never reached the API**:
  - the Garage request reaches the Battery Manufacturer without a page reload, and the Manufacturer only sees its own company's requests and batteries;
  - Customer is read-only, and shows the change to Waste;
  - the Sorting Centre goes from "not up to date" to "up to date";
  - Garage, Customer and Sorting Centre only list and open the batteries they have scanned;
  - Manufacturer sign-up requires a company, saves it locally and sends nothing about the account to the API;
  - a new battery sends only the fields of query N, and its QR code opens it for a Garage;
  - lists stay separate per account and survive reloads, and logging out and in; a direct URL is blocked for another garage;
  - QR codes read from a photo, a large image and a simulated camera, with clear messages for unknown codes, invalid files and a refused camera;
  - staged telemetry appears in the Modules table next to the database values; Garage and Battery Manufacturer get **Update values**, and Customer does not;
  - no horizontal scrolling at the widths checked for each flow, and no console errors other than the favicon 404.
- With the API stopped, the app shows a "Data problem" banner.

A clean clone of the merged `main` installed, passed the tests, built and read the database.

**Not confirmed:** the whole flow on real data through the screens, including creating a battery with the final code and clicking **Update values**. The database shows that someone on the team approved a request on `BAT-0001` and created `BAT-0002`, but not whether that used the screens. To repeat with the group, following the demo steps in the README, with Abhi resetting afterwards.

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

- Lists and company filters only limit what the screens show: the API still returns every battery.
- A battery joins a customer's list as soon as they scan it, so two customers can list the same battery.
- Accounts and lists created in a browser before MongoDB were not moved, so they must be created again.
- The database has no extinguishing agent ("Not recorded" on screen).
- Queries I and I2 only reset `BAT-0001`; other test batteries are deleted with query P.
- Garage and Battery Manufacturer show the diagnosis, module levels and alerts from Neo4j. The module reading history (query F) is not charted yet.
- Reading batteries needs no login, and role checks do not compare companies, so a manufacturer could approve another company's battery. The API only accepts connections from the same computer, so it cannot be hosted online as it is.
- There is no transfer to the sorting centre in the app, and no recycling decision: no order, carrier or document (Défis #2 and #3, which we did not choose). The slides must say so, because the brief's objective mentions them in the full workflow.
- Screens were only tried in a desktop browser at tablet and phone widths, not on real devices.
- The demo needs the team's Neo4j and MongoDB and their passwords, so a jury cannot replay it alone unless it follows **Recreate the data** in the README.
- The Garage report is free text. New batteries show "No reading" until telemetry or the team's simulator updates them.
- Telemetry thresholds are fixed in the code (`OK` up to 4.0 mΩ, `WARNING` up to 5.0, then `CRITICAL`), so they do not follow `StaticPerformance.maxInternalResistanceMohm` for other models. Anyone with the ngrok URL can send readings, though they only wait for review. A simulator on another computer must go through ngrok, because the API no longer accepts network connections.
- The Battery Manufacturer cannot reject a request, because the brief does not include it.

## Next steps

1. Before submitting or sharing the project, change the Neo4j password and remove the real values from `db/.env.example` and from `py_emulator/.env.example` on the `emulator` branch. The team accepts it being in this public repository for now.
2. After pulling, each teammate runs `npm install` and adds `MONGODB_URI` to `db/.env`, or the API will not start. Try the login from the network you will demo on, with a phone hotspot as a backup.
3. Confirm the whole flow on real data with the group, then have Abhi reset the battery (queries I and I2) and delete test batteries (query P).
4. Finish Défi #1: the brief asks for an emulated BMS, which is not on `main` yet. Choose the telemetry path (see Open decisions), move the emulator to `main`, test it through ngrok, and decide whether the telemetry update belongs to Garage, Battery Manufacturer or both.
5. Prepare the slides, mockups or diagrams, and the demo video.

## Open decisions

- **Who can click Update values:** see step 4 above. For now the API allows Garage and Battery Manufacturer.
- **Two telemetry paths:** the API holds readings for review and uses the passport ID, while the emulator on the `emulator` branch writes straight to Neo4j and uses the battery ID. The group should choose which one the demo shows.
- **`customer-role` branch:** already merged into `main`, so it can be deleted.

## Working together

- Database rules are in [db/README_TEAM.md](db/README_TEAM.md): tell the group before changing data, only Abhi runs the scenario and the reset, and nobody runs query J.
- Proposal, still to agree: work on a branch and tell the group before merging into `main`, so that two people's changes do not collide.
- After every `git pull`, restart both terminals, as the README explains.

## Stake holders and their needs :  

    Garage Mechanics : Id of battery, statut, key parameters (), history of the battery 

    Responsible of Battery passport and the R&D part : notification of the garage mechanics, being able to modified the statut of the battery, taking data for the feedback 

    Recycler center : All the informations for the recycling part (garage mech data, etc …) 

    Bettery components manufacturers: The campanies that creates all the components of the battery => need to folow each component of the battery and its state 

    The battery owners => they may want to know more about the battery in their vehicles 

    Eureopean union => get the origin of the batteries, apply reglementations,  