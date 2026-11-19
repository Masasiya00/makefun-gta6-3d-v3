# SOLMAR BAY 3D

[![make.fun](https://img.shields.io/badge/make.fun-gta6--01-ff5c8a)](https://make.fun)
[![competition](https://img.shields.io/badge/competition-gta6--01-blue)](https://make.fun)
[![repo](https://img.shields.io/badge/repo-Masasiya00%2Fmakefun--gta6--3d--v3-green)](https://github.com/Masasiya00/makefun-gta6-3d-v3)

An original open-world crime game in the browser, in the spirit of GTA 6 —
built entirely from scratch with procedural low-poly art, procedural WebAudio
sound and radio, and no network requests at all.

You are **Mara**, a driver new to the sun-soaked coastal city of **Solmar Bay**.
Rosa runs a garage and hands you the jobs: twelve story missions across twelve
districts, from a first set of wheels on Palm Beach to a five-star finale at
the marina. Steal cars, outrun the police (and their helicopter), rob a store,
win a street race, ram a roadblock — and earn the respect to become
King of the Bay.

## How to play

Open `game/index.html` in desktop Chrome (or run `node serve.ts` and open
http://localhost:8080). No build step, no install, no internet needed.

- **W A S D** — walk / drive · **Mouse** — look around · **Shift** — sprint
- **Space** — jump (on foot) / handbrake (driving)
- **E** — get in / out of a car, enter a shop, talk
- **F** — punch · **Left click** — shoot (aim with the mouse)
- **1–5** — switch weapon · **Tab** (hold) — weapon wheel
- **R** — change radio station · **M** — mute · **P / Esc** — pause
- **G** — toggle the mission tracker detail

Missions unlock in order. Finish one to save progress, get paid and earn
respect. Free roam is always available between missions. Progress saves to
local storage automatically.

## What's inside

- A 3,600 × 2,600 m coastal city: 12 districts, a beach and ocean, a harbour,
  an airfield, a fairground ferris wheel, a university, a stadium and a
  lighthouse with a rotating beam.
- 8 drivable car models, ~35 traffic cars, ~60 pedestrians, day/night cycle
  with golden-hour sunset as the default look.
- A 1–5 star wanted system: police pursuit with line-of-sight, a search zone,
  roadblocks from 3 stars, a police helicopter with a searchlight from 3 stars,
  and a live police response panel in the HUD.
- 12 story missions with dialogue and portraits, a respect system
  (Rookie → Wheelman → Shot Caller → King of the Bay), 5 shops, garage
  upgrades, 4 weapons, 3 procedural radio stations and full saving.
- Deterministic screenshots: `?shot=chase|city|mission|night&seed=7`.
  `?autoplay` runs a scripted self-test and reports pass/fail.

## Tech

three.js (vendored minified build under `game/vendor/three/`), plain ES
modules, fixed 1/60 s simulation steps separated from rendering, WebAudio for
every sound. Everything is original and procedural — no assets from any
commercial game.
