# DD_Treasure26 backend (Google Apps Script)

Runs as **ddtreasures26@gmail.com**. Stores everything in your Drive folder `DDTreasure26-Data`
(`catalog.json`, `reviews.json`, `orders.json`, `images/`). No database, no server to pay for.

## Deploy (about 5 minutes)

1. Sign in as ddtreasures26@gmail.com and open https://script.google.com → **New project**. Name it `DDTreasure26 backend`.
2. Delete the sample code and paste the whole of [`Code.gs`](./Code.gs). Click **Save**.
3. Check the constants at the top (`CLIENT_ID`, `ADMIN_EMAIL`, ...). They are already filled in.
4. Run once to authorise: select the function `doGet` in the toolbar → **Run** → **Review permissions** → choose your account →
   **Advanced → Go to DDTreasure26 backend (unsafe) → Allow**. (The warning appears because the script is yours and unverified; it needs Drive access.)
5. **Deploy → New deployment → ⚙ Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy** and copy the **Web app URL** (ends in `/exec`).
6. Send that URL to be wired into the app. It goes in `.env.production` as `VITE_API_URL=<url>`.

When you change `Code.gs` later: **Deploy → Manage deployments → ✏ Edit → Version: New version → Deploy** (the URL stays the same).

## What it does

| Who | Action |
| --- | --- |
| Everyone | Read the catalog (products, categories, shop settings) and visible reviews |
| Signed-in customer | Place an order (prices and stock are checked on the server), see their orders, mark payment sent, cancel an unpaid order, write a review |
| Admin only | Save catalog, upload images to Drive, view all orders, change status, set the final courier charge, manage reviews, create coupons |

- Every request is checked against Google (`tokeninfo`): the token must be issued for this app's client ID and the email must be verified. Admin actions need the email `ddtreasures26@gmail.com`.
- Coupons live in `coupons.json`, which only the admin can read, so codes are never exposed. Each customer can use a code once; cancelling an order gives the code back.
- Product options (sizes, colours) are validated on the server, and stock is shared by all options of a product.
- Stock drops when an order is moved to **Confirmed** (and returns if it is later cancelled or moved back).
- **No emails are sent.** Customers see their order status in the app (Profile and My orders); orders arrive in Admin → Orders and on WhatsApp.

## Limits to know

- Free Apps Script quotas are generous for a small shop; each request takes roughly 0.5-2 s.
- Product images are stored as files in Drive and linked by URL, so the catalog stays small.
- Push notifications while the app is closed are not possible from Apps Script; the app alerts on status changes whenever it is open.
