# Aether Clash: Rune Slingers (16-Bit Retro Arcade Edition)

A 2-player local, single-keyboard 2D arena knockback brawler built with zero-dependency Vanilla HTML5 Canvas and ES6+ JavaScript.

**Made and Developed By:** **Rudra Pathak**  
**Project Idea:** **HackClub Haven Chd**

---

## 🎮 Game Overview

Aether Clash is a fast-paced physics brawler inspired by 16-bit arcade fighters like *Street Fighter* and *Smash Bros.* There are no health bars: landing Kinetic Runes destabilizes opponents, increasing their knockback multiplier (`+25%` per hit). Ring out your opponent by blasting them off the suspended stone monolith into the deep abyss (`y > 920`).

### Core Features:
- **Zero Dependencies:** Pure HTML5 Canvas + Vanilla ES6+ JavaScript. No npm, no external engines or frameworks.
- **Standalone Transparent Pixel Art:** Sliced directly from the high-res character assets into individual transparent PNGs (`char_vanguard.png`, `char_sentinel.png`, `char_gunner.png`, `char_berserker.png`). Completely immune to browser CORS or tainted canvas errors on local `file:///` protocols!
- **Integrated Web Audio Chiptune Synthesizer:** Dynamic 16-bit arcade combat music loop and retro sound effects (jump sweeps, arcane casts, rocket vaults, punchy hit impacts, ring-out crashes, and victory fanfares) synthesized with the browser's native Web Audio API.
- **CRT Arcade Aesthetic:** Dark-bezel CRT frame, vignette curvature, scanlines, and Google Font `'Press Start 2P'` with pixel drop-shadows.

---

## 🛡️ Fighter Roster

1. **VANGUARD** (`char_vanguard.png`) — Agile dual-swordsman with balanced stride and recoil.
2. **SENTINEL** (`char_sentinel.png`) — Heavy defense warrior wielding a round shield and broadsword.
3. **GUNNER** (`char_gunner.png`) — Slotted-visor knight armed with a heavy arcane kinetic launcher.
4. **BERSERKER** (`char_berserker.png`) — Fierce red-faced brawler with a head bandage, serrated blade, and shield.

*(Note: As requested, the row 3 knock-out sprites, the spear fighter, and the outlaw have been removed from the active roster).*

---

## 🕹️ Controls (Single-Keyboard Local 2-Player)

| Action | Player 1 (Cyan / Sapphire) | Player 2 (Gold / Solar) |
| :--- | :--- | :--- |
| **Move West (Left)** | **A** | **Left Arrow (◀)** |
| **Move East (Right)** | **D** | **Right Arrow (▶)** |
| **Aether Leap (Jump)** | **W** | **Up Arrow (▲)** |
| **Focus Down (Aim Down)** | **S** | **Down Arrow (▼)** |
| **Cast Kinetic Rune** | **F** or **Space** | **K** or **Enter** |
| **Aether-Vault Recovery** | Hold **S** + **F** / **Space** | Hold **▼** + **K** / **Enter** |
| **Manual Reset** | **R** | **R** |
| **Back / Cancel** | **Escape** | **Escape** |

> **🚀 Aether-Vault Recovery:** When knocked off the edge into the abyss, hold **Down + Cast** to fire a Kinetic Rune downward, propelling your fighter skyward with powerful recoil (`vy = -545`) to rocket back onto the stage!

---

## 📺 Game Screens

1. **Start Screen:**
   - Vibrant retro teal sky (`#1b8a8f`) with drifting pixel clouds and rising dust plumes.
   - Massive jagged golden graffiti title logo (`AETHER CLASH`) with thick dark-maroon outlines and geometric diamond accents.
   - Large crimson diamond **START** button flanked by white arrows.
   - Interactive beveled toggle buttons for **BGM** (music note) and **SFX** (speaker).
   - Retro **`?`** modal displaying the complete controls card.

2. **Character Select Screen:**
   - 16-bit arcade `SELECT YOUR FIGHTER` grid featuring 4 large 200×200 character cards.
   - P1 (Cyan cursor) and P2 (Gold cursor) navigate with keys or mouse clicks and lock in.
   - Large animated fighter previews and glowing central `VS` emblem that flashes `GET READY!` when both lock in.

3. **Fighting Screen & Arcade HUD:**
   - **Stage:** 16-bit twilight city skyline with glowing neon signs (`ARCADE`, `BAR`, `FIGHT`, `RUNE`), atmospheric streetlamps, and a suspended brick monolith platform with purple rune trim.
   - **Top HUD:** Framed character portraits with `[L]` and `[R]` badges, golden fighter names, `WINS` counters, boxed digital countdown timer (`0:58`), round counter (`ROUND 1`), and segmented yellow-to-red Knockback Instability Bars (`0%` climbing upward).
   - **Bottom HUD:** Compact command panels with `VAULT` recharge gauges (`%`), directional move badges, and stacked 7-digit arcade score readouts (`P1 SCORE: 0000000` / `P2 SCORE: 0000000`).

4. **Round Results & Replay Screen:**
   - Massive golden `K.O.!` banner and match winner announcement.
   - Final 7-digit arcade scores and match breakdown.
   - Winner standing in victory stance.
   - Interactive beveled crimson buttons: **REMATCH** (same fighters) and **CHANGE FIGHTER** (returns to character select).

---

## 🚀 Deployment

- **Play Locally:** Open `index.html` directly in any modern desktop web browser (Chrome, Edge, Firefox, Safari).
- **GitHub Pages:** Push all files to your GitHub repository and enable Pages from `Settings` -> `Pages` -> `Branch: main / (root)`.
- **itch.io:** Zip `index.html`, `style.css`, `game.js`, `char_*.png`, and `README.md` into `aether-clash-html5.zip`. Upload to itch.io with **Kind of project: HTML** and viewport set to **1280 x 720** (responsive scaling enabled).
