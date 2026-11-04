# Battery Passport

Proof of concept for the ESILV x Capgemini Engineering hackathon: a React web app covering the Garage, Passport Owner and Sorting Centre roles, with a small API that reads and writes the team's shared Neo4j database.

```
React (browser)  →  API in server/  →  Neo4j Aura
```

## Run

Requires Node 20.19+ or 22.12+.

```sh
git clone https://github.com/Quuartu/Hackathon.git
cd Hackathon
npm install
```

Create `db/.env` with the connection values from Abhi (see [db/README_TEAM.md](db/README_TEAM.md)). Git ignores this file: never commit real values.

Then run these in two terminals:

```sh
npm run server
npm run dev
```

Open the URL that Vite prints, usually http://localhost:5173/. Run the tests with `npm test`; they do not touch the database.

## Replay the demo

Test accounts, all with the password `demo1234`:

| Emails | Role |
|---|---|
| `manufacturer1@demo.example`, `manufacturer2@demo.example`, `manufacturer3@demo.example` | Battery Manufacturer |
| `garage1@demo.example`, `garage2@demo.example`, `garage3@demo.example` | Garage |
| `owner1@demo.example`, `owner2@demo.example`, `owner3@demo.example` | Passport Owner |
| `sorting1@demo.example`, `sorting2@demo.example`, `sorting3@demo.example` | Sorting Centre |

These accounts are stored in `src/accounts.json`, with plain-text passwords for testing, and work on every computer that clones the repo. To add one, add an entry to the file with `email`, `role` (`manufacturer`, `garage`, `owner` or `sorting`) and `password`.

You can also create an account with an email, a password and a role. It is saved only in your browser, not in the repo. After login, each account goes straight to its role.

Open the app in three tabs and log in with a different account in each. Each tab keeps its own login, and screens refresh every 5 seconds.

**These steps change the database that the whole team shares.** Tell the group first. Afterwards, only Abhi can restore the battery, with query I in [db/queries.cypher](db/queries.cypher).

1. **Garage:** scan `BAT-0001`, enter a diagnosis, then click **Notify Passport Owner**.
2. **Passport Owner:** in **Notifications**, click **Change status to Waste**.
3. **Sorting Centre:** scan `BAT-0001` and check that the page shows **Passport up to date** with the status Waste.

The **Battery Manufacturer** role generates a QR code from a passport ID, for example `BP-2027-0001`. The code contains that ID. A newly generated ID is not saved to the database.

For testing, **Demo mode** at the top right lets you choose a role and enter without logging in. It only appears with `npm run dev`, not in production builds.

## Limitations

- The database holds one battery, `BAT-0001`. It has no extinguishing agent, so that field shows "Not recorded".
- The API has no login check and only accepts connections from the same computer. Add both a login check and hosting setup before putting it online.
- If the free Aura instance is paused, the app shows an error until Abhi resumes it (console.neo4j.io).
- QR scanning is simulated with a list of labels and an ID field: the app generates QR codes but cannot read them yet.
- Login is for the demo only, not real security. Checks run in the browser, created accounts stay in that browser, and anyone can sign up with any role. Passwords of created accounts are stored as salted hashes; those in `src/accounts.json` are in plain text.
- Creating an account, and logging in with a created one, needs `localhost` or HTTPS, because browsers only allow the hashing API (`crypto.subtle`) there. The accounts in `src/accounts.json` also work over plain HTTP on a local network address.


