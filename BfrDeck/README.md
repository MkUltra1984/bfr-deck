# BFR Deck

A read-only desktop companion for **Brave Frontier Revived** (the fan revival at bfrevive.net). It docks beside the BlueStacks window and shows your squads with the game's battle sprites, this week's banners and featured units, reset timers, a unit / item / gate browser with live where-to-get data, "should I pull?" odds, a team checklist and a beginner guide.

It never touches the game: no input, no memory access, no traffic interception. It reads the public JSON feeds on bfrevive.net and, optionally, a screenshot of the emulator through adb.

## Build and run

Requirements: Windows 10/11, .NET 9 SDK, the WebView2 runtime (ships with Windows 11).

```
cd BfrDeck
dotnet build -c Release
bin\Release\net9.0-windows10.0.19041.0\win-x64\BfrDeck.exe
```

Release download (one self-contained exe, wwwroot embedded and unpacked to `%LOCALAPPDATA%\BfrDeck\wwwroot\<version>` on first start): `tools\publish.ps1` → `publish\BfrDeck.exe`.

Useful switches:

```
BfrDeck.exe --deck "#/units/10017"     open the deck on a route
BfrDeck.exe --ocrtest frame.png        run the live-stats reader on a saved 1080x1920 frame, log result, exit
```

Logs and cache live in `%LOCALAPPDATA%\BfrDeck` (`log.txt`, `cache\`, `settings.json`, `webview\`).

## Layout

| Path | What |
|---|---|
| `MainWindow.xaml(.cs)` | WPF shell: custom title bar, tabs (Deck, BFRevived, Wiki), dock beside BlueStacks, pin on top, `https://api.bfrdeck` request handler |
| `DataCache.cs` | Disk cache for bfrevive.net JSON (3 h TTL, stale copy when offline, host allowlist) |
| `LiveReader.cs` | Optional live stats: `adb exec-out screencap` + Windows OCR on the home-screen header |
| `wwwroot/` | The whole UI, plain HTML/JS, no build step |
| `wwwroot/data.js` | Feed loading and indexes (units, items, summons, events) |
| `wwwroot/rules.js` | Server-specific numbers from the Discord guide (frogs, evolution, Merit Shop, resets) |
| `wwwroot/guide.js` | Beginner guide text |
| `wwwroot/collection.js` | Owned units, bookmarks, squads (localStorage), unit picker |
| `wwwroot/roles.js` | Reads skill text into roles for the team checklist |
| `wwwroot/sprite.js` | Battle sprite animator (CGG/CGS frame data from the site, atlas from the CDN) |
| `wwwroot/view-*.js` | One file per screen: home, units, items, gates, team, guide, vortex (dungeon page) |

## Data sources

- `https://bfrevive.net/data/{units,items,summons,events}.json`: pushed by the game host twice a day.
- `https://bfrevive.net/units/meta.json` and `/units/u/<id>.json`: stats, skills, animation frames.
- `https://cdn.bfrevive.net/content/...`: unit icons, sprite atlases, banner art.

## Rules of the server

Macros, modified APKs, modified emulators and cheat tools are banned on BF Revived. Keep every feature read-only. The live-stats reader is off by default and only reads pixels.

Not affiliated with the BF Revived team, gumi or Alim.
