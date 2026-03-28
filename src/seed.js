'use strict';

// Player catalogue — 80 players across positions, ratings, and rarities
const PLAYERS = [
  // Legendary GKs
  { name: 'M. Neuer',      position: 'GK',  nationality: 'Germany',   rating: 92, pace: 61, shooting: 25, passing: 72, defending: 91, rarity: 'legendary' },
  { name: 'A. Courtois',   position: 'GK',  nationality: 'Belgium',   rating: 91, pace: 59, shooting: 22, passing: 70, defending: 90, rarity: 'legendary' },
  // Epic GKs
  { name: 'E. Martinez',   position: 'GK',  nationality: 'Argentina', rating: 87, pace: 60, shooting: 20, passing: 65, defending: 87, rarity: 'epic' },
  { name: 'A. Onana',      position: 'GK',  nationality: 'Cameroon',  rating: 85, pace: 62, shooting: 20, passing: 68, defending: 85, rarity: 'epic' },
  // Rare GKs
  { name: 'G. Donnarumma', position: 'GK',  nationality: 'Italy',     rating: 83, pace: 64, shooting: 18, passing: 64, defending: 83, rarity: 'rare' },
  { name: 'D. Henderson',  position: 'GK',  nationality: 'England',   rating: 79, pace: 58, shooting: 16, passing: 60, defending: 79, rarity: 'rare' },
  // Common GKs
  { name: 'S. Mandanda',   position: 'GK',  nationality: 'France',    rating: 74, pace: 55, shooting: 14, passing: 58, defending: 74, rarity: 'common' },
  { name: 'P. Gulacsi',    position: 'GK',  nationality: 'Hungary',   rating: 72, pace: 54, shooting: 13, passing: 56, defending: 72, rarity: 'common' },

  // Legendary DEFs
  { name: 'V. van Dijk',   position: 'DEF', nationality: 'Netherlands', rating: 92, pace: 79, shooting: 60, passing: 78, defending: 94, rarity: 'legendary' },
  { name: 'M. Skriniar',   position: 'DEF', nationality: 'Slovakia',  rating: 87, pace: 75, shooting: 58, passing: 73, defending: 89, rarity: 'legendary' },
  // Epic DEFs
  { name: 'A. Rudiger',    position: 'DEF', nationality: 'Germany',   rating: 86, pace: 82, shooting: 55, passing: 70, defending: 88, rarity: 'epic' },
  { name: 'W. Saliba',     position: 'DEF', nationality: 'France',    rating: 85, pace: 83, shooting: 50, passing: 72, defending: 86, rarity: 'epic' },
  { name: 'J. Gvardiol',   position: 'DEF', nationality: 'Croatia',   rating: 84, pace: 84, shooting: 52, passing: 73, defending: 85, rarity: 'epic' },
  { name: 'D. Upamecano',  position: 'DEF', nationality: 'France',    rating: 83, pace: 85, shooting: 48, passing: 68, defending: 84, rarity: 'epic' },
  // Rare DEFs
  { name: 'B. White',      position: 'DEF', nationality: 'England',   rating: 80, pace: 78, shooting: 50, passing: 70, defending: 81, rarity: 'rare' },
  { name: 'M. Acuna',      position: 'DEF', nationality: 'Argentina', rating: 80, pace: 80, shooting: 55, passing: 74, defending: 80, rarity: 'rare' },
  { name: 'C. Romero',     position: 'DEF', nationality: 'Argentina', rating: 81, pace: 76, shooting: 52, passing: 69, defending: 82, rarity: 'rare' },
  { name: 'T. Hernandez',  position: 'DEF', nationality: 'France',    rating: 82, pace: 85, shooting: 65, passing: 72, defending: 79, rarity: 'rare' },
  // Common DEFs
  { name: 'K. Akanji',     position: 'DEF', nationality: 'Switzerland', rating: 78, pace: 78, shooting: 46, passing: 66, defending: 79, rarity: 'common' },
  { name: 'M. Dier',       position: 'DEF', nationality: 'England',   rating: 75, pace: 70, shooting: 44, passing: 64, defending: 76, rarity: 'common' },
  { name: 'L. Balerdi',    position: 'DEF', nationality: 'Argentina', rating: 73, pace: 72, shooting: 42, passing: 62, defending: 74, rarity: 'common' },
  { name: 'S. Pavard',     position: 'DEF', nationality: 'France',    rating: 76, pace: 74, shooting: 50, passing: 67, defending: 77, rarity: 'common' },

  // Legendary MIDs
  { name: 'K. De Bruyne',  position: 'MID', nationality: 'Belgium',   rating: 94, pace: 76, shooting: 86, passing: 97, defending: 65, rarity: 'legendary' },
  { name: 'L. Modric',     position: 'MID', nationality: 'Croatia',   rating: 89, pace: 74, shooting: 76, passing: 93, defending: 68, rarity: 'legendary' },
  { name: 'T. Kroos',      position: 'MID', nationality: 'Germany',   rating: 88, pace: 65, shooting: 77, passing: 95, defending: 64, rarity: 'legendary' },
  // Epic MIDs
  { name: 'J. Bellingham',  position: 'MID', nationality: 'England',  rating: 90, pace: 83, shooting: 85, passing: 88, defending: 76, rarity: 'epic' },
  { name: 'B. Fernandes',  position: 'MID', nationality: 'Portugal',  rating: 86, pace: 75, shooting: 82, passing: 88, defending: 62, rarity: 'epic' },
  { name: 'P. Foden',      position: 'MID', nationality: 'England',   rating: 88, pace: 83, shooting: 83, passing: 87, defending: 59, rarity: 'epic' },
  { name: 'F. Valverde',   position: 'MID', nationality: 'Uruguay',   rating: 86, pace: 84, shooting: 80, passing: 83, defending: 78, rarity: 'epic' },
  { name: 'D. Rice',       position: 'MID', nationality: 'England',   rating: 85, pace: 78, shooting: 72, passing: 82, defending: 85, rarity: 'epic' },
  // Rare MIDs
  { name: 'M. Verratti',   position: 'MID', nationality: 'Italy',     rating: 83, pace: 68, shooting: 72, passing: 90, defending: 72, rarity: 'rare' },
  { name: 'G. Lo Celso',   position: 'MID', nationality: 'Argentina', rating: 81, pace: 76, shooting: 76, passing: 85, defending: 64, rarity: 'rare' },
  { name: 'T. Arnold',     position: 'MID', nationality: 'England',   rating: 84, pace: 79, shooting: 77, passing: 88, defending: 68, rarity: 'rare' },
  { name: 'R. Brozovic',   position: 'MID', nationality: 'Croatia',   rating: 82, pace: 74, shooting: 73, passing: 86, defending: 74, rarity: 'rare' },
  // Common MIDs
  { name: 'A. Witsel',     position: 'MID', nationality: 'Belgium',   rating: 78, pace: 65, shooting: 68, passing: 80, defending: 76, rarity: 'common' },
  { name: 'M. Torreira',   position: 'MID', nationality: 'Uruguay',   rating: 76, pace: 70, shooting: 66, passing: 77, defending: 78, rarity: 'common' },
  { name: 'Y. Zakaria',    position: 'MID', nationality: 'Switzerland', rating: 74, pace: 72, shooting: 64, passing: 73, defending: 77, rarity: 'common' },
  { name: 'A. Nandez',     position: 'MID', nationality: 'Uruguay',   rating: 75, pace: 76, shooting: 65, passing: 74, defending: 75, rarity: 'common' },

  // Legendary FWDs
  { name: 'E. Haaland',    position: 'FWD', nationality: 'Norway',    rating: 96, pace: 96, shooting: 97, passing: 75, defending: 40, rarity: 'legendary' },
  { name: 'K. Mbappe',     position: 'FWD', nationality: 'France',    rating: 95, pace: 99, shooting: 93, passing: 82, defending: 40, rarity: 'legendary' },
  { name: 'V. Osimhen',    position: 'FWD', nationality: 'Nigeria',   rating: 90, pace: 93, shooting: 90, passing: 73, defending: 38, rarity: 'legendary' },
  { name: 'H. Kane',       position: 'FWD', nationality: 'England',   rating: 91, pace: 78, shooting: 95, passing: 83, defending: 44, rarity: 'legendary' },
  // Epic FWDs
  { name: 'L. Diaz',       position: 'FWD', nationality: 'Colombia',  rating: 86, pace: 91, shooting: 83, passing: 79, defending: 45, rarity: 'epic' },
  { name: 'R. Lukaku',     position: 'FWD', nationality: 'Belgium',   rating: 86, pace: 85, shooting: 88, passing: 72, defending: 43, rarity: 'epic' },
  { name: 'B. Saka',       position: 'FWD', nationality: 'England',   rating: 87, pace: 87, shooting: 83, passing: 85, defending: 55, rarity: 'epic' },
  { name: 'R. Leao',       position: 'FWD', nationality: 'Portugal',  rating: 86, pace: 93, shooting: 82, passing: 80, defending: 40, rarity: 'epic' },
  { name: 'M. Salah',      position: 'FWD', nationality: 'Egypt',     rating: 90, pace: 91, shooting: 88, passing: 83, defending: 48, rarity: 'epic' },
  { name: 'V. Junior',     position: 'FWD', nationality: 'Brazil',    rating: 91, pace: 95, shooting: 86, passing: 82, defending: 37, rarity: 'epic' },
  // Rare FWDs
  { name: 'M. Olise',      position: 'FWD', nationality: 'France',    rating: 83, pace: 85, shooting: 80, passing: 81, defending: 42, rarity: 'rare' },
  { name: 'C. Pulisic',    position: 'FWD', nationality: 'USA',       rating: 80, pace: 82, shooting: 78, passing: 76, defending: 48, rarity: 'rare' },
  { name: 'W. Gnonto',     position: 'FWD', nationality: 'Italy',     rating: 77, pace: 88, shooting: 74, passing: 72, defending: 38, rarity: 'rare' },
  { name: 'F. Estupinan',  position: 'FWD', nationality: 'Ecuador',   rating: 79, pace: 83, shooting: 76, passing: 71, defending: 44, rarity: 'rare' },
  { name: 'J. Doku',       position: 'FWD', nationality: 'Belgium',   rating: 81, pace: 95, shooting: 76, passing: 75, defending: 36, rarity: 'rare' },
  // Common FWDs
  { name: 'T. Adams',      position: 'FWD', nationality: 'USA',       rating: 74, pace: 76, shooting: 71, passing: 68, defending: 52, rarity: 'common' },
  { name: 'K. Dolberg',    position: 'FWD', nationality: 'Denmark',   rating: 73, pace: 73, shooting: 73, passing: 65, defending: 35, rarity: 'common' },
  { name: 'J. Gomez',      position: 'FWD', nationality: 'Spain',     rating: 72, pace: 72, shooting: 70, passing: 67, defending: 36, rarity: 'common' },
  { name: 'S. Obi',        position: 'FWD', nationality: 'Nigeria',   rating: 70, pace: 78, shooting: 68, passing: 62, defending: 32, rarity: 'common' },
];

// Coin packs for sale (the monetisation catalogue)
const COIN_PACKS = [
  { name: 'Starter Pack',    coins: 500,   price_usd: 0.99,  bonus_pct: 0  },
  { name: 'Player Pack',     coins: 1500,  price_usd: 2.99,  bonus_pct: 5  },
  { name: 'Club Pack',       coins: 4000,  price_usd: 6.99,  bonus_pct: 15 },
  { name: 'League Pack',     coins: 10000, price_usd: 14.99, bonus_pct: 25 },
  { name: 'Elite Bundle',    coins: 25000, price_usd: 29.99, bonus_pct: 40 },
  { name: 'Champions Bundle',coins: 75000, price_usd: 79.99, bonus_pct: 60 },
];

function seedDatabase(db) {
  const playerCount = db.prepare('SELECT COUNT(*) AS n FROM players').get().n;
  if (playerCount === 0) {
    const insertPlayer = db.prepare(
      `INSERT INTO players (name, position, nationality, rating, pace, shooting, passing, defending, rarity)
       VALUES (@name, @position, @nationality, @rating, @pace, @shooting, @passing, @defending, @rarity)`
    );
    const seedPlayers = db.transaction(() => {
      for (const p of PLAYERS) insertPlayer.run(p);
    });
    seedPlayers();
  }

  const packCount = db.prepare('SELECT COUNT(*) AS n FROM coin_packs').get().n;
  if (packCount === 0) {
    const insertPack = db.prepare(
      `INSERT INTO coin_packs (name, coins, price_usd, bonus_pct) VALUES (@name, @coins, @price_usd, @bonus_pct)`
    );
    const seedPacks = db.transaction(() => {
      for (const p of COIN_PACKS) insertPack.run(p);
    });
    seedPacks();
  }
}

module.exports = { seedDatabase, PLAYERS, COIN_PACKS };
