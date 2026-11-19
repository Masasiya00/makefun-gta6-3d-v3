# SOLMAR BAY 3D

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Masasiya00/makefun-gta6-3d-v3/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Masasiya00/makefun-gta6-3d-v3/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game in the browser, built for make.fun's
**gta6-01 — Make GTA 6** competition. You are Mara, a driver new to the
coastal city of Solmar Bay: steal cars, outrun the SBPD, run 12 story
missions for Rosa and the crew, buy weapons and garage upgrades, climb the
respect ranks from Rookie to King of the Bay — all at golden hour.

## The city

Twelve districts across a 3,600 × 2,600 m coast: Palm Beach, Old Town,
Dockside, Downtown, Marina, Coral Heights, Airfield, Bayview, Fairground,
University, Stadium and Lighthouse Point. Traffic cars, sixty pedestrians,
an ocean with animated waves, a rotating lighthouse beam and a ferris wheel.

## Features

- **On foot and by car** — third-person camera, 8 drivable models, carjacking, damage and wrecks
- **Wanted 1–5 stars** — police pursuit cars, a helicopter with a searchlight from 3 stars, roadblocks, line-of-sight IN SIGHT indicator and a search-zone circle on the minimap
- **Police response panel** — live unit callsigns, distances and states (PURSUIT / RAMMING / SPOTLIGHT / ROADBLOCK)
- **12 story missions** — dialogue with portraits, timers, rewards up to $3,000
- **Combat** — fists, pistol, SMG, shotgun and rifle with a 5-slot weapon wheel and ammo
- **5 shops** — Rosa's Garage (repairs + engine/brakes/plating upgrades), Ironworks Arms, Tico Tacos, Neon Threads, Marina Motors (cars unlocked by respect)
- **Respect ranks** — Rookie → Wheelman → Shot Caller → King of the Bay
- **Radio** — three procedural WebAudio stations (chill, dance, talk)
- **Save / load** — progress in localStorage; **pause, busted/wasted and victory screens**
- **HUD + circular minimap** — mission tracker, stars, money, district, clock, vehicle panel, radio strip

## How to play

Serve `game/` with any static server and open `index.html` in desktop Chrome
(`node serve.ts`, then http://localhost:8080). No build step, no network requests.

| Key | Action |
| --- | --- |
| WASD / arrows | Walk / drive |
| Mouse | Look around |
| E | Enter / exit car |
| F | Open shop near a shop door |
| M | Start the next mission |
| 1–5 | Switch weapon |
| Mouse click | Shoot / punch |
| R | Next radio station |
| P / Esc | Pause |
| Z / L | Save / load |
| X | Mute |

Deterministic screenshots: `?shot=chase|city|mission|night&seed=7`.
Self-test: `?autoplay=1` plays the game and reports pass/fail in `window.__autoplay`.

## Tech

three.js r160 (vendored under `game/vendor/three/`), plain ES modules, fixed
1/60 s simulation steps, procedural low-poly art and WebAudio sound — no
external assets. `main.ts` hands the game in with the make.fun dossier library.

Built for [make.fun/bounty/gta6-01](https://make.fun/bounty/gta6-01) — $1,666 prize pool.
