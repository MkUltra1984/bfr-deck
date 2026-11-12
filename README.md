<p align="center">
  <img src="docs/img/home.gif" alt="BFR Deck docked beside Brave Frontier Revived">
</p>

<h1 align="center">BFR Deck</h1>

<p align="center">
  <b>The desktop companion for <a href="https://bfrevive.net">Brave Frontier Revived</a>.</b><br>
  Docks beside your emulator. Knows your box, your squads, every gate, dungeon and unit.
</p>

<p align="center">
  <a href="https://github.com/MkUltra1984/bfr-deck/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/MkUltra1984/bfr-deck?style=for-the-badge&color=e0b24a&labelColor=1d1f25&label=Download"></a>
  <img alt="Windows" src="https://img.shields.io/badge/Windows_10%2F11-x64-6fa8dc?style=for-the-badge&labelColor=1d1f25">
  <img alt="Read-only" src="https://img.shields.io/badge/Read--only-no_input%2C_no_memory%2C_no_traffic-6fc98a?style=for-the-badge&labelColor=1d1f25">
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/License-MIT-e8e6df?style=for-the-badge&labelColor=1d1f25"></a>
</p>

<p align="center">
  <a href="README.de.md">🇩🇪 Deutsche Anleitung</a> &nbsp;·&nbsp; <a href="BfrDeck/CHANGELOG.md">📋 Changelog</a> &nbsp;·&nbsp; <a href="https://github.com/MkUltra1984/bfr-deck/issues">🐛 Report a problem</a>
</p>

---

## ⬇️ Install

**1.** Download `BfrDeck-win-x64.zip` from the [latest release](https://github.com/MkUltra1984/bfr-deck/releases/latest) and unzip it anywhere.
**2.** Double-click `BfrDeck.exe`. Nothing else to install.
**3.** That was the last download: from version 1.2.0 the deck updates itself. When a new version is out, a bar under the tabs offers it; one click installs it.

> [!IMPORTANT]
> Windows SmartScreen warns once because the exe is not code-signed. Click **More info → Run anyway**. The complete source is in this repository; build it yourself if you prefer.

> [!NOTE]
> **Read-only by design.** The deck reads the public data of bfrevive.net and, only if you turn it on, a picture of your emulator window. It never sends input, never reads memory, never touches network traffic. Nothing the server rules forbid.

## 🏠 Home

<table>
<tr>
<td width="50%" valign="top"><img src="docs/img/feat/header.png" alt="Live header"><br>🔴 <b>Live header</b> · your name, <b>gems, Zel and Karma</b> read from the game screen. <b>Reset timers</b> for dailies, the Vortex day and the weekly selector.</td>
<td width="50%" valign="top"><img src="docs/img/feat/squad.png" alt="Squad stage"><br>⚔️ <b>Your squad</b> · the real <b>battle sprites</b> on element-lit platforms, with cost, elements and leader skill. Filled by the unit scan.</td>
</tr>
<tr>
<td valign="top"><img src="docs/img/feat/pull.png" alt="Should I pull"><br>🎲 <b>Should I pull?</b> · odds per rarity, how much of the gate you <b>already own</b>, gems per new unit, the gate's <b>Meta Units</b>. <b>I pulled…</b> logs a summon session in one go.</td>
<td valign="top"><img src="docs/img/feat/featured.png" alt="Featured units"><br>✨ <b>Featured this week</b> · the collab and rate-up units walk past; drag to browse.<br><br><img src="docs/img/feat/banners.png" alt="Banners"><br>🎫 <b>Banners</b> · this week's gates with price and time left, next week's below.</td>
</tr>
<tr>
<td colspan="2" valign="top"><img src="docs/img/feat/vortex-tile.png" alt="Vortex Gate tile"><br>🌀 <b>Vortex Gate</b> · the week as day chips, one card per open dungeon with <b>what it gives in plain words</b> and its captures or drops as pictures. A card opens the dungeon page.</td>
</tr>
</table>

## 🧩 Units

<table>
<tr>
<td width="50%" valign="top"><img src="docs/img/feat/units.png" alt="Units"><br>🔍 <b>Units</b> · search with typo tolerance, element and rarity filters, cards or table. <b>✔ owned</b>, <b>★ bookmarked</b>.</td>
<td width="50%" valign="top"><img src="docs/img/feat/unit-page.png" alt="Unit page"><br>📄 <b>Unit page</b> · animated sprite, stats, roles, every skill, and <b>where to get it</b>: gates with rates, quests with capture chance.</td>
</tr>
<tr>
<td valign="top"><img src="docs/img/feat/box.png" alt="Box"><br>📦 <b>Box</b> · your collection with progress per rarity and element. Rescan after selling or fusing.</td>
<td valign="top"><img src="docs/img/feat/tier.png" alt="Tier List"><br>🏆 <b>Tier List</b> · every unit <b>S to C</b> by max stats and the roles its skills cover. Filter by element, rarity, role, or owned only.</td>
</tr>
</table>

## 🎰 Summon and Quests

<table>
<tr>
<td width="50%" valign="top"><img src="docs/img/feat/summon.png" alt="Summon"><br>🎰 <b>Summon</b> · this week, next week, the always-open gates and the rotation with dates.</td>
<td width="50%" valign="top"><img src="docs/img/feat/gate-page.png" alt="Gate page"><br>💎 <b>Gate page</b> · the <b>verdict against your box</b>, chances per rarity, the full pool with owned marks.</td>
</tr>
<tr>
<td valign="top"><img src="docs/img/feat/quests.png" alt="Quests"><br>🗺️ <b>Quests</b> · the whole Vortex Gate as a catalog, plus Grand Quest, Story, Frontier Hunter, Frontier Gate and Trials, each with <b>what it gives</b>.</td>
<td valign="top"><img src="docs/img/feat/dungeon.png" alt="Dungeon page"><br>🏰 <b>Dungeon page</b> · what it gives, then every level with <b>captures and their chance</b>, drops per kill, enemies.</td>
</tr>
</table>

## 🛡️ Team Builder

<table>
<tr>
<td colspan="2" valign="top"><img src="docs/img/feat/team-slots.png" alt="Slots"><br>🃏 <b>Six slots</b> · five units and the friend lead. <b>★</b> leader, <b>⇄</b> swap, <b>✕</b> remove, drag to reorder, two spheres per slot.</td>
</tr>
<tr>
<td width="50%" valign="top"><img src="docs/img/feat/team-matrix.png" alt="Buff matrix"><br>📊 <b>Who brings what</b> · totals, both leader skills, and a matrix of healing, mitigation, BB fill and buffs per slot. <b>Missing effects are marked.</b></td>
<td width="50%" valign="top"><img src="docs/img/feat/team-gaps.png" alt="Fill the gaps"><br>🧠 <b>Fill the gaps</b> · the best units <b>from your box</b> for each missing effect; one click puts them in. Share a squad with a <b>team code</b>.</td>
</tr>
</table>

## 📖 Beginner guide

<table>
<tr>
<td width="50%" valign="top"><img src="docs/img/feat/guide.png" alt="First steps"><br>✅ <b>Six first steps</b> · link the account, claim the gems, story, selectors, one finished team, the daily loop. Tick them off; the deck remembers. An <b>Every day</b> checklist resets at 00:00 UTC.</td>
<td width="50%" valign="top"><img src="docs/img/feat/guide-cards.png" alt="Topic cards"><br>🗂️ <b>One card per topic</b> · currencies, frogs, evolution, imps, spheres, farming days, summons, getting help. Each opens its own short page. <b>Every game term</b> in the deck explains itself on hover.</td>
</tr>
</table>

## 🚀 First start

<table>
<tr>
<td width="50%" valign="top"><img src="docs/img/feat/intro.png" alt="Welcome"><br>👋 <b>Welcome and tour</b> · one card per tab and panel, shown over the real thing. Replay it from the Box page.</td>
<td width="50%" valign="top"><img src="docs/img/feat/tour.png" alt="Tour card"><br>🎯 <b>Tour card</b> · the panel it describes is scrolled into view and <b>outlined in gold</b>.</td>
</tr>
<tr>
<td valign="top"><img src="docs/img/feat/scan.png" alt="Unit scanner"><br>📷 <b>Unit scanner</b> · open the unit list in the game and scroll. The deck watches the emulator window, snaps a grid to the rows, <b>matches every icon</b> and reads the ×N stacks. The yellow PARTY ribbon becomes Squad 1. <b>No calibration, any emulator.</b></td>
<td valign="top"><img src="docs/img/feat/quick-add.png" alt="I pulled"><br>➕ <b>I pulled…</b> · after a summon session tick what you got from the gate's pool. <b>Done</b> adds it to your box.</td>
</tr>
</table>

## 🪟 Docked

<img src="docs/img/docked.png" alt="BFR Deck docked beside BlueStacks">

**Dock** snaps the deck to the emulator's side and keeps the two together when either moves. **BlueStacks, LDPlayer, Nox, MEmu, MuMu, GameLoop** and the Android Studio emulator are recognised; for anything else hold <kbd>Shift</kbd>, click Dock, click the emulator. **Pin** keeps the deck on top.

## ⌨️ Command line

| Switch | Effect |
|---|---|
| `--dock` | dock beside the emulator on start |
| `--deck "#/home/99017"` | open a route; `#/home/<gate>` preselects the Should-I-pull gate |
| `--ocrtest frame.png` | run the live-stats reader on a saved 1080×1920 frame and exit |

Logs, cache and settings live in `%LOCALAPPDATA%\BfrDeck`.

## 🔧 Build from source

Windows 10/11 and the [.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9.0).

```powershell
cd BfrDeck
dotnet build -c Release
bin\Release\net9.0-windows10.0.19041.0\win-x64\BfrDeck.exe
```

The UI is plain HTML and JavaScript in `BfrDeck/wwwroot` with no build step: edit, press reload. `rules.js` holds the server-specific numbers. `tools\publish.ps1` produces the single exe. Code layout: [BfrDeck/README.md](BfrDeck/README.md).

## ⚖️ Server rules and license

> [!WARNING]
> Macros, modified clients, modified emulators and cheat tools are **banned** on BF Revived. BFR Deck stays on the right side of that line: public data, a picture of the screen, no input, no memory, no traffic. Keep it that way in forks.

**MIT**, see [LICENSE](LICENSE). Brave Frontier and all game artwork, unit names and data belong to their respective owners (gumi / Alim); Brave Frontier Revived is a fan project at bfrevive.net. This companion is not affiliated with any of them.

**Thanks** to [BF Companion](https://bfcompanion.app/) (Nervequakes): the sphere types the deck uses for its sphere suggestions come from its data, and every unit page links to that unit there.
