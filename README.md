# Battery Passport

Proof of concept for the ESILV x Capgemini Engineering hackathon: a React web app covering the Battery Manufacturer, Garage, Customer and Sorting Centre roles, with a small API that reads and writes the team's shared Neo4j database, and keeps accounts in MongoDB.

```
React (browser)  →  API in server/  →  Neo4j Aura (batteries)
                                    →  MongoDB Atlas (accounts and their lists)
```

## Start from zero in VS Code

You need [Node.js](https://nodejs.org/) 20.19+ or 22.12+, [Git](https://git-scm.com/) and [VS Code](https://code.visualstudio.com/). Check Node with `node -v`.

### 1. Get the project

In VS Code, open a terminal with **Terminal > New Terminal**, then run:

```sh
git clone https://github.com/Quuartu/Hackathon.git
```

Choose **File > Open Folder**, select the new `Hackathon` folder, and open a terminal again. It now runs inside the project.

### 2. Install and set up the database connection

On Mac or Linux:

```sh
npm install
cp db/.env.example db/.env
```

On Windows (PowerShell):

```powershell
npm install
Copy-Item db\.env.example db\.env
```

`db/.env` holds the connection values for the shared databases. Git ignores it, so never commit it. If `db/.env.example` only contains placeholders, ask Abhi for the Neo4j values (see [db/README_TEAM.md](db/README_TEAM.md)).

In `db/.env`, replace `<db_password>` in `MONGODB_URI` with the MongoDB password, which the team shares privately. Your IP address must also be allowed in MongoDB Atlas, under **Network Access**. Without this, login fails with `Cannot reach the accounts database`.

### 3. Start the API and the app

The app needs two terminals, both left open. In the first one, run:

```sh
npm run server
```

Wait for `API on http://127.0.0.1:3001`. Then click **+** in the terminal panel to open a second terminal, and run:

```sh
npm run dev
```

### 4. Open the app

Open the URL that Vite prints, usually http://localhost:5173/, in Chrome. Log in with a test account from [Replay the demo](#replay-the-demo).

To stop, press `Ctrl+C` in each terminal, on Mac too.

### After every `git pull`

Stop both terminals, then run `npm install`, `npm run server` and `npm run dev` again. The page updates by itself, but the API keeps running the old code until you restart it.

### If something goes wrong

| Problem | Fix |
|---|---|
| Blank page when opening a battery | The API is out of date. Restart `npm run server`. |
| "Data problem" banner | The API is off, or Aura is paused. Check the first terminal; if the API is running, ask Abhi to resume Aura. If the message names MongoDB, see the next row. |
| `Cannot reach the accounts database` | Your IP is not allowed in MongoDB Atlas (**Network Access**), the password in `MONGODB_URI` is wrong, or the network blocks port 27017. Try a phone hotspot to rule out the network. |
| `Incorrect email or password` with a test account | The test accounts are not in this database yet. Run `npm run seed-accounts` once. |
| `MONGODB_URI is missing` | Add it to `db/.env`, as in step 2. |
| Logged out after restarting the API | Expected: login sessions are kept in the API's memory. Log in again. |
| `EADDRINUSE` | An old API is still running. Close all terminals in VS Code and start again. If it continues, restart VS Code. |
| `bad option: --env-file` | Node is too old. Update it. |
| Windows: `running scripts is disabled` | In the terminal panel, use the **+** menu to open **Command Prompt**, then run the same `npm` commands there. |
| `Failed to resolve import` | A dependency is missing. Run `npm install`. |
| `git pull` stops because of local changes | Do not force it. Commit or save your changes first. |

Run the tests with `npm test`; they do not touch the database.

## Replay the demo

Test accounts, all with the password `demo1234`:

| Emails | Role |
|---|---|
| `manufacturer1@demo.example`, `manufacturer2@demo.example`, `manufacturer3@demo.example` | Battery Manufacturer |
| `garage1@demo.example`, `garage2@demo.example`, `garage3@demo.example` | Garage |
| `customer1@demo.example`, `customer2@demo.example`, `customer3@demo.example` | Customer |
| `sorting1@demo.example`, `sorting2@demo.example`, `sorting3@demo.example` | Sorting Centre |

These accounts are stored in MongoDB with hashed passwords, and work on every computer. One person loads them once with `npm run seed-accounts`. Repeating it is safe: existing accounts and their lists stay as they are.

The three manufacturer test accounts belong to the company `VoltaDrive`.

You can also create an account with an email, a password and a role. A Battery Manufacturer account also chooses its company from a list of the companies in the database. Accounts and their lists of scanned batteries are saved in MongoDB, so they follow you to any computer. Nothing about accounts is stored in Neo4j. After login, each account goes straight to its role.

Open the app in three tabs and log in with a different account in each. Each tab keeps its own login, and screens refresh every 5 seconds.

**These steps change the database that the whole team shares.** Tell the group first. Afterwards, only Abhi can restore the battery, with queries I and I2 in [db/queries.cypher](db/queries.cypher).

1. **Battery Manufacturer:** open **Create new battery**, create one, and keep its QR code on screen. The QR code contains the passport ID.
2. **Garage:** scan that QR code or enter its passport ID, such as `BP-2027-0002`, enter a diagnosis, then click **Notify manufacturer**. A battery ID such as `BAT-0002` is refused.
3. **Battery Manufacturer:** in **Notifications**, click **Change status to Waste**.
4. **Customer:** scan the same battery and check that it shows **Out of service**. This role is read-only.
5. **Sorting Centre:** scan it and check that the page shows **Passport up to date** with the status Waste.

Garage, Customer and Sorting Centre each only see the batteries they have scanned, in **Your batteries**.

The **Battery Manufacturer** role covers the brief's Passport Owner: it handles garage requests and sees all the batteries of its company, with their details and QR codes. The form's economic operators and models come from the account's company, and it suggests the next free IDs, such as `BAT-0002` and `BP-2027-0002`. Tell the group before creating batteries; test batteries are deleted with query P in [db/queries.cypher](db/queries.cypher).

For testing, **Demo mode** at the top right lets you choose a role and enter with its first test account, such as `garage1@demo.example`, without typing a password. It needs MongoDB like a normal login, and only appears with `npm run dev`, not in production builds.

## Telemetry API (ngrok & Défi #1)

The backend listens for real-time telemetry payloads (such as from a simulator or sensor forwarded via ngrok):

### 1. Expose the API with ngrok

In a new terminal:
```sh
npm run ngrok
# or: npx ngrok http 3001
```

Through ngrok, only the telemetry routes are available. Everything else answers 403. ngrok needs a free account the first time.

### 2. Send telemetry to the endpoint

Send a `POST` request to `http://localhost:3001/api/telemetry` (or your ngrok URL `https://<id>.ngrok-free.app/api/telemetry`):

```sh
curl -X POST http://localhost:3001/api/telemetry \
  -H "Content-Type: application/json" \
  -d '{"batteryPassportId":"BP-2027-0002","I_A":84.3,"modules":[{"id":1,"dV_V":0.694,"R_mOhm":8.23},{"id":2,"dV_V":0.513,"R_mOhm":6.08},{"id":3,"dV_V":0.388,"R_mOhm":4.60},{"id":4,"dV_V":0.318,"R_mOhm":3.78},{"id":5,"dV_V":0.524,"R_mOhm":6.22}]}'
```

From PowerShell:

```powershell
$body = @{
    batteryPassportId = "BP-2027-0002"
    I_A = 84.3
    modules = @(
        @{ id = 1; dV_V = 0.694; R_mOhm = 8.23 }
        @{ id = 2; dV_V = 0.513; R_mOhm = 6.08 }
        @{ id = 3; dV_V = 0.388; R_mOhm = 4.60 }
        @{ id = 4; dV_V = 0.318; R_mOhm = 3.78 }
        @{ id = 5; dV_V = 0.524; R_mOhm = 6.22 }
    )
}
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/telemetry" -ContentType "application/json" -Body ($body | ConvertTo-Json -Depth 5)
```

The passport ID is required, in the JSON or the URL (`/api/telemetry/BP-2027-0002`). A request with only a `batteryId` gets a 400, and an unknown passport ID gets a 404.

Each person's API keeps its own waiting telemetry, so to reach someone else's screen, send to the ngrok URL of their API.

With `npm run dev`, you can also click **⚡ Simulate telemetry** above the Modules table.

### 3. Review and apply to Neo4j

1. The **Modules** table immediately displays the new incoming values alongside the old values in distinct highlight colors for side-by-side comparison.
2. A button **Update values** appears, for Garage and Battery Manufacturer.
3. Clicking it writes the new module resistances, creates historical `Reading` nodes, triggers `Alert` nodes in Neo4j, and updates the battery diagnosis and overall resistance increase. **This changes the shared database**, so tell the group first.

Telemetry waiting for review is kept in memory, so restarting `npm run server` discards it.

## Limitations

- The database has no extinguishing agent, so that field shows "Not recorded".
- The API only accepts connections from the same computer. Actions that change battery data need a login with the right role: only a Garage reports, only a Battery Manufacturer creates batteries and approves Waste, and Garage or Battery Manufacturer can apply telemetry. Reading batteries needs no login, and the check does not compare companies. Fix both before putting it online.
- Lists and company filters only limit what the screens show: the API still returns every battery.
- A battery joins a customer's list as soon as they scan it, so two customers can list the same battery.
- If MongoDB is unreachable, nobody can log in, even with Neo4j running. Test from the network you will demo on, and keep a phone hotspot as a backup.
- If the free Aura instance is paused, the app shows an error until Abhi resumes it (console.neo4j.io).
- Garage, Customer and Sorting Centre scan QR codes with the camera or a photo. Browsers only allow the live camera on `localhost` or HTTPS, so over plain HTTP on a local network address use a photo or enter the ID.
- Login is for the demo only, not real security: anyone can sign up with any role, and the test accounts' password is written here. Passwords are stored as salted hashes, and the API checks them.


