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

There are no test accounts: you pick a role on the home page. Open the app in three tabs of the same browser, one per role.

1. **Garage:** scan `BAT-2023-0001`, enter a diagnosis, then click **Notify Passport Owner**.
2. **Passport Owner:** in **Notifications**, click **Change status to Waste**.
3. **Sorting Centre:** scan `BAT-2023-0001` and check that the page shows **Passport up to date** with the status Waste.

**Reset demo data** on the home page restores the initial state.

## Limitations

- Data is fictional (`src/data.js`) and stored in the browser, so roles only sync between tabs of the same browser. There is no Neo4j yet.
- QR scanning is simulated with a list of labels and an ID field.
