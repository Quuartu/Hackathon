"""
BMS emulator for Challenge 1 (Battery Passport hackathon).

Simulates the 5 modules of battery BAT-0001. For each module it fakes a small
current step (delta I) and the resulting voltage drop (delta V), computes the
internal resistance R = delta V / delta I (in milliohm) and writes it to Neo4j.

Usage:
  pip install neo4j
  python bms_emulator.py --init                      # create the graph from schema.cypher
  python bms_emulator.py --scenario normal           # 6 ticks, all modules healthy
  python bms_emulator.py --scenario degrade          # module 3 drifts up until CRITICAL
  python bms_emulator.py --scenario critical         # module 3 is critical straight away
  python bms_emulator.py --scenario degrade --dry-run  # print only, no database

Connection settings come from environment variables (or a .env file):
  NEO4J_URI, NEO4J_USER (or NEO4J_USERNAME), NEO4J_PASSWORD, optional NEO4J_DATABASE
"""
import argparse
import os
import random
import re
import time
from pathlib import Path

BASE_R = [2.4, 2.9, 3.1, 2.6, 3.3]          # healthy resistance per module (mOhm)
BAD_MODULE = 3                               # the module that goes bad (1-5)
DEGRADE_RAMP = [3.1, 3.6, 4.3, 5.4, 7.0, 9.8]  # module 3 drifting up (mOhm)
MAX_R = 5.0                                  # must match StaticPerformance.maxInternalResistanceMohm
WARN_RATIO = 0.8

WRITE_READING = """
MATCH (b:BatteryInstance {batteryId: $bid})-[:HAS_MODULE]->(m:Module {index: $idx})
MATCH (b)<-[:HAS_BATTERY_INSTANCE]-(:Model)-[:HAS_STATIC_PERFORMANCE]->(sp:StaticPerformance)
WITH b, m, sp, m.lastLevel AS prev, $r AS r
WITH b, m, prev, r,
     CASE WHEN r > sp.maxInternalResistanceMohm THEN 'CRITICAL'
          WHEN r > sp.maxInternalResistanceMohm * sp.warnRatio THEN 'WARNING'
          ELSE 'OK' END AS level
WITH b, m, prev, r, level,
     round((r - m.initialResistanceMohm) / m.initialResistanceMohm * 1000.0) / 10.0 AS inc
CREATE (rd:Reading {timestamp: datetime(), currentStepA: $di, voltageDropV: $dv,
                    resistanceMohm: r, increasePct: inc, level: level})
CREATE (m)-[:HAS_READING]->(rd)
SET m.lastResistanceMohm = r, m.lastIncreasePct = inc, m.lastLevel = level, m.lastReadingAt = rd.timestamp
WITH b, m, rd, level, prev
FOREACH (_ IN CASE WHEN level = 'CRITICAL' AND coalesce(prev, 'OK') <> 'CRITICAL' THEN [1] ELSE [] END |
  CREATE (a:Alert {level: 'CRITICAL', createdAt: datetime(), resistanceMohm: rd.resistanceMohm,
                   message: 'Internal resistance above manufacturer maximum'})
  CREATE (m)-[:HAS_ALERT]->(a))
RETURN level
"""

UPDATE_DIAGNOSIS = """
MATCH (b:BatteryInstance {batteryId: $bid})-[:HAS_MODULE]->(m:Module)
WITH b, collect(m.lastLevel) AS levels, max(m.lastIncreasePct) AS worst
MATCH (b)-[:HAS_DYNAMIC_PERFORMANCE]->(dp:DynamicPerformance)
SET b.diagnosis = CASE WHEN 'CRITICAL' IN levels THEN 'CRITICAL'
                       WHEN 'WARNING' IN levels THEN 'WARNING' ELSE 'OK' END,
    dp.internalResistanceIncreasePct = worst
RETURN b.diagnosis AS diagnosis
"""


DB = None  # set from NEO4J_DATABASE if present (Aura files include it)


def load_env():
    env = Path(__file__).with_name(".env")
    if env.exists():
        for line in env.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"'))


def level_of(r):
    return "CRITICAL" if r > MAX_R else "WARNING" if r > MAX_R * WARN_RATIO else "OK"


def resistances(scenario, tick):
    r = [x * random.uniform(0.97, 1.03) for x in BASE_R]
    i = BAD_MODULE - 1
    if scenario == "degrade":
        r[i] = DEGRADE_RAMP[min(tick, len(DEGRADE_RAMP) - 1)] * random.uniform(0.98, 1.02)
    elif scenario == "critical":
        r[i] = 9.8 * random.uniform(0.98, 1.02)
    return r


def measure(r_mohm):
    """Fake sensor values for one module. R = dV / dI."""
    di = random.uniform(38.0, 42.0)          # current step in A
    dv = (r_mohm / 1000.0) * di              # voltage drop in V
    return round(di, 2), round(dv, 4)


def run_statements(session, text):
    text = re.sub(r"(?m)^\s*//.*$", "", text)   # drop comment lines
    for stmt in [s.strip() for s in text.split(";") if s.strip()]:
        session.run(stmt).consume()


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--init", action="store_true", help="run schema.cypher")
    p.add_argument("--scenario", choices=["normal", "degrade", "critical"])
    p.add_argument("--battery", default="BAT-0001")
    p.add_argument("--ticks", type=int, default=6)
    p.add_argument("--interval", type=float, default=2.0, help="seconds between ticks")
    p.add_argument("--dry-run", action="store_true")
    a = p.parse_args()

    load_env()
    global DB
    DB = os.environ.get("NEO4J_DATABASE") or None
    driver = None
    if not a.dry_run:
        from neo4j import GraphDatabase
        driver = GraphDatabase.driver(
            os.environ["NEO4J_URI"],
            auth=(os.environ.get("NEO4J_USER") or os.environ.get("NEO4J_USERNAME") or "neo4j", os.environ["NEO4J_PASSWORD"]),
        )
        driver.verify_connectivity()
        print("Connected to Neo4j.")

    if a.init:
        if a.dry_run:
            raise SystemExit("--init needs a real connection")
        with driver.session(database=DB) as s:
            run_statements(s, Path(__file__).with_name("schema.cypher").read_text())
        print("Graph created from schema.cypher.")

    if a.scenario:
        for tick in range(a.ticks):
            print(f"--- tick {tick + 1} ({a.scenario}) ---")
            for idx, r in enumerate(resistances(a.scenario, tick), start=1):
                di, dv = measure(r)
                r_calc = round(dv / di * 1000.0, 2)      # back to mOhm from dV/dI
                if a.dry_run:
                    print(f"  module {idx}: dI={di} A  dV={dv} V  R={r_calc} mOhm  -> {level_of(r_calc)}")
                else:
                    with driver.session(database=DB) as s:
                        lvl = s.run(WRITE_READING, bid=a.battery, idx=idx, r=r_calc, di=di, dv=dv).single()["level"]
                    print(f"  module {idx}: R={r_calc} mOhm -> {lvl}")
            if not a.dry_run:
                with driver.session(database=DB) as s:
                    d = s.run(UPDATE_DIAGNOSIS, bid=a.battery).single()["diagnosis"]
                print(f"  battery diagnosis: {d}")
            time.sleep(a.interval if not a.dry_run else 0)

    if driver:
        driver.close()


if __name__ == "__main__":
    main()
