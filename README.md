# ⚽ Soccer Manager

A browser-based soccer manager game with in-app coin purchases — build your ultimate squad, open player packs, play matches, and dominate the leaderboard.

---

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) 18 or newer
- npm (bundled with Node)

### Install & Run

```bash
# 1. Install dependencies
npm install

# 2. Start the server  (the data/ directory is created automatically)
npm start
```

The server starts at **http://localhost:3000** — open that URL in your browser to play.

> **Development mode** (auto-restarts on file changes):
> ```bash
> npm run dev
> ```

### Run Tests

```bash
npm test
```

All 46 tests cover managers, players, squads, packs, matches, the coin store, and the leaderboard.

---

## How to Play

### 1 — Create Your Manager

Open **http://localhost:3000** and fill in the *Sign In / Register* form:

| Field | Example |
|---|---|
| Username | `alex99` |
| Email | `alex@example.com` |
| Team Name | `Alex United` *(optional)* |

Click **Create / Load Manager**. Your profile card appears showing your stats and coin balance.  
If you come back later, enter the same username + email to reload your existing manager.

---

### 2 — Buy Coins (Coin Store)

Coins are the in-game currency used to open player packs. Click **Coin Store** in the nav.

| Pack | Coins | Price | Bonus |
|---|---|---|---|
| Starter Pack | 500 | $0.99 | — |
| Player Pack | 1,575 | $2.99 | +5% |
| Club Pack | 4,600 | $6.99 | +15% |
| League Pack | 12,500 | $14.99 | +25% |
| Elite Bundle | 35,000 | $29.99 | +40% |
| Champions Bundle | 120,000 | $79.99 | +60% |

Click **Buy Now** on any pack. Your coin balance updates instantly in the top-right badge.

> 💡 **Tip:** Larger packs give bonus coins — the Champions Bundle gives +60% extra, making it the best value per coin.

---

### 3 — Open Player Packs

Click **Open Packs** in the nav to spend coins and receive random players.

| Pack Type | Players | Cost | Legend % | Epic % | Rare % |
|---|---|---|---|---|---|
| Standard | 5 | 🪙 500 | 1% | 4% | 25% |
| Premium | 8 | 🪙 1,500 | 5% | 15% | 40% |
| Elite | 12 | 🪙 4,000 | 15% | 35% | 40% |

Click **Open Pack** on the tier you want. Your drawn players are shown immediately with their ratings and stats. All new players are automatically added to your collection.

**Player rarities** (best → common):

| Rarity | Colour | Rating range |
|---|---|---|
| 🟠 Legendary | Orange border | 87–99 |
| 🟣 Epic | Purple border | 83–91 |
| 🔵 Rare | Blue border | 77–84 |
| ⚫ Common | Grey border | 70–78 |

> 💡 **Tip:** Open Elite packs for the best chance at legendary players like Haaland (96), Mbappé (95), or De Bruyne (94).

---

### 4 — Build Your Squad

Click **My Squad** in the nav to manage your team.

- Your full player collection is shown below the pitch.
- Click **+ Add to Squad** on any player card to slot them into your starting XI (max 11).
- Click the same player again to **remove** them from the starting lineup.
- The pitch diagram at the top updates in real time showing your GK / DEF / MID / FWD rows.

> 💡 **Tip:** The average rating of your **squad** (not just your whole collection) is what determines your match results. Always pick your 11 best-rated players.

---

### 5 — Play Matches

Click **Play Match** → **▶ Kick Off!** to simulate a match against the AI.

**How results work:**

- Your squad rating is compared against the AI's baseline rating of **72**.
- A higher squad rating means more goals and a better chance of winning.
- Results are randomised but weighted — a 90-rated squad will beat the 72-rated AI most of the time.

**Coin rewards per match:**

| Result | Coins earned |
|---|---|
| 🏆 Win | +200 |
| 🤝 Draw | +75 |
| 😞 Loss | +25 |

Your wins, draws, losses, and goals scored are tracked on your profile.

---

### 6 — Leaderboard

Click **Leaderboard** to see the top managers ranked by **points**:

- Win = **3 points**
- Draw = **1 point**
- Loss = **0 points**

Ties in points are broken by total goals scored.

---

### 7 — Revenue Dashboard (Platform Admin)

Click **📊 Revenue** to see real-time platform metrics:

- Total revenue (USD) from coin purchases
- Number of purchases and coins sold
- Breakdown by pack type
- Recent purchase history

---

## Game Loop Summary

```
Register → Buy Coins → Open Packs → Build Squad → Play Matches → Earn Coins → Repeat
```

The better your squad rating, the more matches you win.  
Win more matches, earn more coins, open better packs, discover legendary players.

---

## API Reference

The game is backed by a REST API. All endpoints accept and return JSON.

### Managers

| Method | Path | Description |
|---|---|---|
| `POST` | `/managers` | Register a new manager |
| `GET` | `/managers` | List all managers |
| `GET` | `/managers/:id` | Get a manager's profile |
| `PATCH` | `/managers/:id` | Update team name |

### Players

| Method | Path | Description |
|---|---|---|
| `GET` | `/players` | Browse the player catalogue (`?position=`, `?rarity=`, `?min_rating=`, `?max_rating=`) |
| `GET` | `/players/:id` | Get one player |

### Squad

| Method | Path | Description |
|---|---|---|
| `GET` | `/managers/:id/squad` | List all owned players + squad status |
| `PUT` | `/managers/:id/squad` | Set the starting XI (`{ slots: [{squad_player_id, squad_slot}] }`) |

### Player Packs

| Method | Path | Description |
|---|---|---|
| `GET` | `/packs/types` | List pack types, costs, and rarity odds |
| `POST` | `/packs/open` | Open a pack (`{ manager_id, pack_type: "standard"\|"premium"\|"elite" }`) |

### Coin Store

| Method | Path | Description |
|---|---|---|
| `GET` | `/store/packs` | List coin packs for sale |
| `POST` | `/store/purchase` | Buy a coin pack (`{ manager_id, coin_pack_id }`) |
| `GET` | `/store/revenue` | Platform revenue dashboard |
| `GET` | `/store/purchases/:managerId` | A manager's purchase history |

### Matches

| Method | Path | Description |
|---|---|---|
| `POST` | `/matches` | Play a match (`{ home_manager_id, away_manager_id? }`) |
| `GET` | `/matches` | List recent matches (`?manager_id=` to filter) |
| `GET` | `/matches/:id` | Get one match |

### Leaderboard

| Method | Path | Description |
|---|---|---|
| `GET` | `/leaderboard` | Top managers by points (`?limit=20`) |

---

## Project Structure

```
soccer-manager/
├── src/
│   ├── server.js          # Entry point — starts HTTP server
│   ├── app.js             # Express app + route wiring
│   ├── database.js        # SQLite schema (WAL mode)
│   ├── seed.js            # 57 players + 6 coin packs
│   ├── cache.js           # LRU cache utility
│   └── routes/
│       ├── managers.js    # Manager CRUD
│       ├── players.js     # Player catalogue
│       ├── squads.js      # Squad management
│       ├── packs.js       # Player pack opening
│       ├── matches.js     # Match simulation
│       ├── store.js       # Coin store + revenue
│       └── leaderboard.js # Rankings
├── public/
│   └── index.html         # Browser SPA (all 8 pages)
├── tests/                 # Jest + Supertest (46 tests)
├── data/                  # SQLite DB (auto-created, git-ignored)
└── package.json
```

---

## Tech Stack

- **Runtime:** Node.js + Express 5
- **Database:** SQLite via `better-sqlite3` (WAL mode, foreign keys on)
- **Frontend:** Vanilla JS SPA served as a static file
- **Tests:** Jest + Supertest
