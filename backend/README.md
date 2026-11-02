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

## Spam protection

Every request already needs a verified Google sign-in. On top of that the server enforces, per account:

| Action | Limit |
| --- | --- |
| Orders | 6 attempts per 10 minutes, at most 5 unpaid orders at once, 3 unconfirmed cash-on-delivery orders, 10 orders per day |
| Reviews | 6 attempts per hour, 6 new reviews per day, no web links, no repeating the same text |
| Coupon codes | 15 tries per 10 minutes (stops code guessing) |

Reviews from customers who have a confirmed order (for that product) are published straight away and get a **Verified buyer** badge. Reviews from anyone else are saved as **awaiting approval** and only appear after you press *Approve* in Admin → Reviews.

## Automatic backup

The script copies `catalog.json`, `orders.json`, `reviews.json` and `coupons.json` into `DDTreasure26-Data/backups/<date>/` and keeps the newest 30 days.

To switch on the **daily** backup (about 2 am India time), once:

1. In the Apps Script editor choose the function **`setupDailyBackup`** in the toolbar and click **Run**. Approve the extra permission (it lets the script create its own timer).
2. **Deploy → Manage deployments → ✏ → Version: New version → Deploy.**
3. Open Admin → Backup. It should say *Daily backup is ON*.

You can also press **Back up to Drive now** in Admin → Backup at any time. To restore, open the dated backup folder in Drive, copy the file you need, and replace the matching file in `DDTreasure26-Data` (or use *Restore from file* in the app for the catalog).

## Staying signed in

Google's own sign-in token only lasts about an hour. After one Google sign-in the server issues its own signed **session token** (valid 30 days, kept in the browser). The app renews it automatically once less than 20 days remain, so anyone who opens the app at least every few weeks stays signed in until they log out. Logging out removes it from that device.

- The signing secret is stored in the script property `SESSION_SECRET` (created automatically). **To sign everybody out at once** (for example if a phone is lost), open Project Settings > Script properties and delete `SESSION_SECRET`; everyone then signs in again.
- Sessions are checked on the server on every request. Admin actions still require the admin email.
- On iPhones, Safari clears a website's saved data after about a week without use. Installing the app to the Home Screen avoids that.

## Cash on delivery

The admin switches it on in **Admin > Shop details > Payment** and sets an optional fee and a largest order value. The server checks it again on every order (a customer cannot enable it themselves). COD orders start as **Awaiting confirmation**, show a 4-step tracker, and each customer can have at most three unconfirmed COD orders at a time. Confirming one reduces stock like any other order. **Turn COD on only after you have deployed this version of the script.**

## Limits to know

- Free Apps Script quotas are generous for a small shop; each request takes roughly 0.5-2 s.
- Product images are stored as files in Drive and linked by URL, so the catalog stays small.
- Push notifications while the app is closed are not possible from Apps Script; the app alerts on status changes whenever it is open.
