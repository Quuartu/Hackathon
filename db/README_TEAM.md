# Battery Passport - shared Neo4j database (Aura, cloud)

The database is already created and loaded online. You do NOT install Neo4j and you do NOT run schema.cypher.
Abhi sends you four connection values privately: URI, username, password, database name.

## 1. Connection settings (put them in your backend, never in front-end code)
```
NEO4J_URI=neo4j+s://xxxxxxxx.databases.neo4j.io
NEO4J_USERNAME=xxxxxxxx
NEO4J_PASSWORD=...
NEO4J_DATABASE=xxxxxxxx
```
The username is NOT "neo4j". Use exactly the values you were given. Do not commit this file to Git.

## 2. Quick test
Python: `pip install neo4j`, then
```python
from neo4j import GraphDatabase
d = GraphDatabase.driver(URI, auth=(USERNAME, PASSWORD))
d.verify_connectivity()
with d.session(database=DATABASE) as s:
    print(s.run("MATCH (n) RETURN count(n) AS c").single()["c"])   # expect 21 on a fresh graph
```
Node.js: install `neo4j-driver` and use `neo4j.driver(URI, neo4j.auth.basic(USERNAME, PASSWORD))`, then `driver.session({database: DATABASE})`.

You can also click **Query** on the instance in console.neo4j.io if Abhi invites you, or ask him to run a query for you.

## 3. Queries for the apps (all in queries.cypher)
| Screen | Query | What it returns |
|---|---|---|
| Mechanic: battery card | C | identification, status, diagnosis, SOH, SOC, cycles, warranty |
| Mechanic: 5 gauges | D | per module: initial, current resistance (mOhm), increase %, level OK/WARNING/CRITICAL |
| Mechanic: alerts | E | alert list with module, message, time |
| Owner: Original to Waste | H | sets status = 'Waste' |
| Sorting center: scan result | C | same card, status must read Waste |

- The apps call a small backend. Only the backend talks to Neo4j.
- QR code content: the `batteryPassportId`, for example `BP-2027-0001`.
- Neo4j returns datetimes as special objects. Wrap them in `toString(...)` in the query or convert in the backend before sending JSON.
- Levels: OK up to 4.0 mOhm, WARNING above 4.0 up to 5.0, CRITICAL above 5.0 (limit in `StaticPerformance.maxInternalResistanceMohm`).
- Status values: Original, Waste (later: Re-used, Remanufactured, Repurposed).

## 4. Rules
- Everyone shares ONE database. Before you change data, tell the group.
- Only Abhi runs the scenario (`bms_emulator.py`) and the reset (query I). After a reset, status is back to Original.
- Never run query J (wipes everything).
- If the app cannot connect, Abhi checks whether the free instance is paused (console.neo4j.io, Resume).
