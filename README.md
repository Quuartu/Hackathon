# Battery Passport

Proof of concept for the ESILV x Capgemini Engineering hackathon: a React web app covering the Garage, Passport Owner and Sorting Centre roles.

## Run

Requires Node 20.19+ or 22.12+.

```sh
git clone https://github.com/Quuartu/Hackathon.git
cd Hackathon
npm install
npm run dev
```

Open the URL that Vite prints, usually http://localhost:5173/. Run the tests with `npm test`.

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

Open the app in three tabs of the same browser and log in with a different account in each. Each tab keeps its own login.

1. **Garage:** scan `BAT-2023-0001`, enter a diagnosis, then click **Notify Passport Owner**.
2. **Passport Owner:** in **Notifications**, click **Change status to Waste**.
3. **Sorting Centre:** scan `BAT-2023-0001` and check that the page shows **Passport up to date** with the status Waste.

The **Battery Manufacturer** role generates a QR code from a passport ID, for example `BP-FR-7F3A91`. The code contains that ID.

For testing, **Demo mode** at the top right lets you choose a role and enter without logging in. It only appears with `npm run dev`, not in production builds.

**Reset demo data** on the login page restores the initial battery data. It does not delete created accounts.

## Limitations

- Data is fictional (`src/data.js`) and stored in the browser, so roles only sync between tabs of the same browser. There is no Neo4j yet.
- QR scanning is simulated with a list of labels and an ID field: the app generates QR codes but cannot read them yet.
- Login is for the demo only, not real security. Checks run in the browser, created accounts stay in that browser, and anyone can sign up with any role. Passwords of created accounts are stored as salted hashes; those in `src/accounts.json` are in plain text.
- Creating an account, and logging in with a created one, needs `localhost` or HTTPS, because browsers only allow the hashing API (`crypto.subtle`) there. The accounts in `src/accounts.json` also work over plain HTTP on a local network address.


