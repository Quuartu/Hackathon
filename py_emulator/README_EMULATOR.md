# BMS emulator and control panel (Challenge 1)

This part of the project simulates the battery management system (BMS) of battery BAT-0001. It produces the internal resistance of the 5 battery modules and writes it into the shared Neo4j database. The mechanic screen of the app then reads those values and shows the alerts.

You can run it in two ways:
- **Control panel (recommended):** a web page with buttons and sliders. File: `bms_server.py` + `control_panel.html`.
- **Command line:** `bms_emulator.py`, no page, good for quick tests.

## How it works

```
Control panel page  ->  bms_server.py  ->  Neo4j database  ->  app (mechanic screen)
(buttons, sliders)      (uses bms_emulator.py)
```

For every module and every round, the emulator creates a small current step (dI, in A) and the voltage drop it causes (dV, in V). It then calculates:

    R = dV / dI        (shown in milliohm, mOhm)

This is the definition of internal resistance used in the Battery Passport attribute list. The value is sent to Neo4j, and the database decides the level:

| Level | Internal resistance |
|---|---|
| OK | up to 4.0 mOhm |
| WARNING | above 4.0 and up to 5.0 mOhm |
| CRITICAL | above 5.0 mOhm |

The first time a module becomes CRITICAL, the database creates one alert. The battery's `diagnosis` (OK, WARNING, CRITICAL) is updated after every round. The battery `status` is NOT touched by the emulator. Only the owner changes it in the app.

## Files

| File | What it is |
|---|---|
| `bms_emulator.py` | The engine: resistance calculation, scenarios, database queries. Also usable from the command line |
| `bms_server.py` | Small local web server that uses the engine and serves the page |
| `control_panel.html` | The page you open in the browser |
| `.env.example` | Template for the connection settings |

Do not share the real `.env` file. Put the real values in your own `.env` only.

## Setup (once)

1. Install Python 3.8 or newer.
2. Put the four files above in one folder.
3. Copy `.env.example` to a new file called `.env` (same folder, no `.txt` at the end) and fill in the values you received from Abhi:
   ```
   NEO4J_URI=neo4j+s://xxxxxxxx.databases.neo4j.io
   NEO4J_USERNAME=xxxxxxxx
   NEO4J_PASSWORD=...
   NEO4J_DATABASE=xxxxxxxx
   ```
   The username is not "neo4j". Use exactly what you were given.
4. Open a terminal in the folder and run:
   ```
   pip install neo4j flask
   ```

## Run the control panel

1. `python bms_server.py`
2. The terminal must say `Connected to Neo4j.` and `Control panel: http://127.0.0.1:5050 (live)`.
3. Open **http://127.0.0.1:5050** in your browser.
4. Stop with Ctrl+C in the terminal.

Try it without the database first: `python bms_server.py --dry-run`. The page works the same, but nothing is written.

## Using the page

- **Battery id:** the battery to feed. Default `BAT-0001`. It must exist in the database.
- **Scenario:**
  - **Normal:** all 5 modules stay between about 2 and 3.5 mOhm (all OK).
  - **Degrade:** module 3 rises round by round: OK, then WARNING, then CRITICAL (about 10 mOhm after 6 rounds).
  - **Critical:** module 3 is critical from the first round.
- **Seconds between rounds:** default 2. The app screen refreshes about every 2 to 3 seconds, so do not go much slower than that for the demo.
- **Start / Stop:** starts or stops sending rounds. Start always begins the scenario from round 0.
- **Hold:** tick it on a module and move its slider. The module stays at that resistance (1 to 12 mOhm), for example to create a fault on module 4. Untick it to go back to the scenario.
- **Colored bar:** the two small marks show the warning (4.0) and critical (5.0) limits.
- **Battery diagnosis:** the overall result calculated by the database.

## Command line (without the page)

```
python bms_emulator.py --scenario normal
python bms_emulator.py --scenario degrade
python bms_emulator.py --scenario degrade --battery BAT-0002 --ticks 10 --interval 1
python bms_emulator.py --scenario degrade --dry-run
```

## Demo order

1. Abhi resets the battery (database queries I and I2).
2. Start **Normal**. The mechanic screen shows 5 green modules.
3. Start **Degrade**. Module 3 turns orange, then red, and an alert appears.
4. The mechanic reports the battery in the app, the owner changes the status to Waste, the sorting center scans the QR code and sees Waste.

## Rules

- Everyone shares ONE database. When you press Start, the real app screens change. Tell the group before you do it, or use a test battery (BAT-0002).
- Do not change a battery's `status` from here.
- Do not run the reset or delete queries (I, I2, J, P in `queries.cypher`). Abhi does that.
- Do not run `python bms_emulator.py --init`. It rebuilds the base data and can overwrite changed values.
- Never put the database password in a Wokwi project, in firmware, or in a Git repository.
- The page only works on the computer that runs the server (address 127.0.0.1).

## Using a Wokwi board or a physical board instead

A Wokwi or Arduino board cannot connect to Neo4j directly. It has to send its measurements over HTTP to a backend endpoint that runs the same two queries (`WRITE_READING` and `UPDATE_DIAGNOSIS` in `bms_emulator.py`). The endpoint needs a public address, because Wokwi's simulated WiFi only reaches the internet and not your laptop. Suggested message from the board, one per module and round:

```
POST /telemetry
{ "batteryId": "BAT-0001", "moduleIndex": 3, "currentStepA": 40.2, "voltageDropV": 0.4015 }
```
The backend computes R = voltageDropV / currentStepA * 1000 (mOhm) and runs the two queries. Ask Abhi if you need this endpoint.

## Troubleshooting

| Problem | Likely cause and fix |
|---|---|
| `KeyError: 'NEO4J_URI'` | The `.env` file is missing, in another folder, or named `.env.txt`. In PowerShell, `dir -Force` shows the real names |
| `AuthError` / authentication failure | Wrong username or password in `.env`. The Aura username is not "neo4j". Check for extra spaces |
| Cannot connect / timeout | Internet problem, or the free instance is paused. Ask Abhi to click Resume in console.neo4j.io |
| Page says "Battery ... was not found" | The battery id does not exist. Check it in the database or use BAT-0001 |
| `ModuleNotFoundError: flask` or `neo4j` | Run `pip install neo4j flask` |
| Port 5050 already in use | Start with `python bms_server.py --port 5060` and open that port |
| Page shows "Cannot reach the server" | `bms_server.py` is not running or was closed |
| App screen does not change | Check the page says "running" and "live", the battery id matches the one in the app, and the app refreshes its data every few seconds |
