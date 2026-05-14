# Ghost Detectives — Product Requirements Document

**Version:** 1.2  
**Date:** 2026-05-12  
**Status:** Beta (LAN Multiplayer — 3D house model complete)

---

## 1. Product Overview

Ghost Detectives is a browser-based 3D first-person cooperative horror game. Up to four players on a local network enter a haunted Victorian house (Whittaker House) and work together to identify which of 14 ghost types haunts it. Evidence is gathered using paranormal investigation tools. Players must correctly identify the ghost type before their sanity runs out or the ghost kills the entire team.

---

## 2. Goals

- Deliver a playable local-area network (LAN) multiplayer horror investigation game in the browser with no install required.
- Provide tense cooperative gameplay through a sanity system, random hunt events, and ghost special abilities.
- Ensure ghost identity is never trivially obtainable — it must be deduced from gathered evidence.
- Support 1–4 players per LAN session with real-time synchronisation.

---

## 3. Platform & Tech Stack

| Layer | Technology |
|---|---|
| Client rendering | Three.js v0.184.0 (WebGL, first-person 3D) |
| Client language | JavaScript (ES Modules, single HTML file) |
| Dev server / module bundling | Vite v8.0.12 (npm required) |
| Game server | Node.js (HTTP + WebSocket, `ws` library) |
| Real-time communication | WebSocket — game server on port 3000 |
| Audio | Web Audio API |
| Post-processing | Three.js EffectComposer + ShaderPass (night-vision green-tint pass) |

**Target:** Modern desktop browsers (Chrome, Firefox, Edge). Pointer Lock API required for mouse-look.

**Running the game (LAN):**
1. `npm install` (first time only)
2. Terminal 1: `npm start` — starts the WebSocket game server on port 3000
3. Terminal 2: `npm run dev` — starts the Vite dev server (default port 5173)
4. Navigate to `http://localhost:5173/ghost-detectives.html`
5. Share `http://<LAN-IP>:5173/ghost-detectives.html` with other players on the same network

---

## 4. Player Flow

```
Browser → Lobby (enter name)
  → Auto-join LAN session (existing or new)
  → Click "ENTER THE HOUSE" to start game
  → Investigation phase (gather evidence, avoid ghost)
    → Hunt events (hide or die)
  → Submit ghost identification
    → Win screen (correct) or keep investigating (wrong)
    → All players dead → Loss screen
```

---

## 5. Core Systems

### 5.1 Session & Lobby

| Requirement | Detail |
|---|---|
| Max players per session | 4 |
| Session creation | Auto-created on first join; new session created if existing ones are full or not in INVESTIGATION phase |
| Session ID | Displayed top-right of HUD; auto-assigned unique code |
| Lobby display | Player name input; single-player label shown (shared lobby player list not yet implemented) |
| Game cannot start with | 0 players |
| Starting location | Van (safe zone with tool shelf) |

### 5.2 House — Whittaker House

The house has 3 floors and 18 named spaces, plus the **Van** (outside).

**Van (Safe Zone):**
| Room ID | Name | Ghost Eligible | Special |
|---|---|---|---|
| van | Investigation Van | No | Woody interior (pine/cedar panels, brass fittings); 7-tool shelf; ghost cannot enter; safe zone during hunts |

The van features a detailed 3D interior: pine-panelled walls with horizontal walnut battens, cedar ceiling with running battens, canvas-texture wood plank floor, rear double doors with brass handles, overhead equipment shelves, a command desk with a green-glow monitor, and ceiling strip lights on a warm amber non-flickering circuit.

**Ground Floor:**
| Room ID | Name | Ghost Eligible |
|---|---|---|
| foyer | Foyer | No (exit point) |
| living_room | Living Room | Yes |
| study | Study | Yes |
| dining_room | Dining Room | Yes |
| kitchen | Kitchen | Yes |
| pantry | Pantry | Yes |
| stairs_up | Stairs (Up) | No |
| stairs_down | Stairs (Down) | No |

**Top Floor:**
| Room ID | Name | Ghost Eligible |
|---|---|---|
| landing_top | Top Floor Landing | No |
| attic | Attic Loft | Yes |
| storage_closet | Storage Closet | Yes |
| guest_bedroom | Guest Bedroom | Yes |
| bathroom_top | Top Bathroom | Yes |

**Basement:**
| Room ID | Name | Ghost Eligible | Special |
|---|---|---|---|
| basement_landing | Basement Landing | No | — |
| boiler_room | Boiler Room | Yes | Contains fuse box (power toggle) |
| cellar | Cellar | Yes | — |
| laundry_room | Laundry Room | Yes | — |
| hidden_room | Hidden Room | Yes (2× weight) | — |

**Ghost room selection:** One ghost-eligible room is randomly selected per session. All evidence events only fire when players are inside that room. The ghost room ID is **never sent to the client**.

**Ghost room detection tools (non-evidence):**
- EMF reader reads **EMF 2** anywhere in the ghost room (vs. EMF 1 elsewhere)
- Thermometer reads **≤ 5°C** in the ghost room (vs. 15–20°C elsewhere)
- Motion sensor flashes red when placed in the ghost room

**Floor transitions:** When a player enters a stairwell and reaches the far trigger boundary, they are teleported to the destination floor's landing room.

**Closets:** Every house room has one closet (a specific position in a corner). Players can hide there during hunts by pressing `E` within 1.2 m of the closet position.

**Exit door:** On the south wall of the Foyer. Locked for all players during active hunts.

**Van tool shelf:** Physical tool pickup system. 7 tools displayed on a shelf. Press `E` to pick up; press `G` to drop. Limited to 2-slot inventory.

---

### 5.3 3D House Model

The entire house is rendered in Three.js using the `HouseDetails` class (~450 meshes total):

| Category | What's included |
|---|---|
| Architectural trim | Baseboards + crown moulding on all rooms; door jambs + headers on all openings |
| Staircases | 8 stacked slab steps per staircase (×2); diagonal handrail via cylinder geometry |
| Per-room furniture | Sofa + fireplace (Living Room); L-desk + lamp (Study); dining table + 4 chairs (Dining); L-counter + stove (Kitchen); bed + wardrobe (Bedroom); boiler + pipes (Boiler Room); crates + trunk (storage rooms); coat rack (Foyer/hallways); basin + mirror (Bathroom); chair + papers (Hidden Room) |
| Procedural textures | Canvas-generated wood plank floor, plaster wall noise, brick pattern (Boiler Room) |
| Atmospheric details | Cobwebs (Attic, Hidden Room — 2–3 strands per corner); scattered papers (Hidden Room) |
| Van interior | Full woody interior (see §5.2) |

**Lighting:**
- Global ambient: `0x333322` at intensity 0.6 (warm fill)
- Per-room point lights: warm colour by floor (`ground` = `0xffcc88`, `top` = `0xddaacc`, `basement` = `0x88aacc`); intensity 2.5, range 16, decay 2; scheduled random flickering
- Van: two non-flickering ceiling strip lights (`0xffddaa`, intensity 4.0, range 14)
- Tone mapping: ACES Filmic at exposure 0.85
- Fog: `FogExp2` density 0.04

---

### 5.4 Player

| Property | Detail |
|---|---|
| Perspective | First-person (PointerLockControls) |
| Movement | WASD, mouse-look (yaw + pitch), no jumping |
| Speed | 4.5 m/s |
| Collision | Per-axis AABB against solid walls; doorways between connected rooms are always open |
| Starting position | Van (safe zone) at world coordinates (0, 1.7, 9) |
| Camera height | 1.7 m above floor |
| Inventory | 2-slot system; press `E` near shelf/dropped item to pick up; press `G` to drop held item |

**Player states:**

| State | Effect |
|---|---|
| Normal | Full movement, tools usable |
| Hiding | Teleported to closet position; no movement; ghost cannot target or kill |
| Dead | No movement or tools; spectator camera mode enabled |
| Spectator | Free-cam, no collision, no tools; can view map tablet |

---

### 5.5 Sanity

| Property | Detail |
|---|---|
| Starting value | 100% |
| Passive drain | 0.3% per second (per living, non-hiding player) |
| Yurei bonus drain | +0.2% per second additional |
| Phantom drain | +1.5% per second extra while looking at the ghost during a hunt |
| Minimum | 0% |
| Display | Shown only to the local player (bar + percentage, bottom-left HUD) |
| Team average sanity | Used for hunt interval calculation (single-player: uses local sanity) |

---

### 5.6 Hunt System

| Property | Detail |
|---|---|
| Hunt trigger interval | `120 − ((100 − teamAvgSanity) × 0.8)` seconds, minimum 30 s |
| Pre-hunt warning | 10 seconds before each hunt; "HUNT IN Xs" displayed centre-top |
| Hunt duration | 20 seconds |
| Hunt sound | Heartbeat sound effect plays during active hunt via Web Audio API |
| Effects on start | Exit door locks; ghost becomes visible; ghost chases nearest living non-hiding player; heartbeat starts |
| Effects on end | Ghost becomes invisible; exit door unlocks; player hiding state cleared; heartbeat stops |
| Van safe zone | Ghost cannot enter van; players in van are immune to ghost during hunts |
| Door lock | Van door is locked during hunts, preventing entry/exit |
| Hiding | Player presses `E` within 1.2 m of any closet → teleported to closet position; immune to ghost |
| Player death | Ghost reaches within 0.8 m of a non-hiding player → player dies; spectator mode activates |
| All players dead | Game immediately ends with a loss result |

---

### 5.7 Ghost AI

- During **investigation phase**: ghost wanders the room graph every 20–30 s (invisible to players; position used only for proximity-based evidence calculations).
- During **hunt phase**: ghost uses BFS on the room graph to pathfind toward the nearest living, non-hiding player. Position is broadcast to clients at 10 Hz. Clients interpolate ghost position (lerp factor 0.15 per frame).
- Ghost position and identity are **never sent to clients outside of a hunt**.

---

## 6. Evidence System

There are **6 evidence types** used for ghost identification, plus the motion sensor (ghost-room detection only).

### 6.1 Evidence Types

| ID | Name | Tool | How detected |
|---|---|---|---|
| `emf5` | EMF Level 5 | EMF Reader | Reader spikes to 5 in ghost room (30% chance per tick) |
| `freezingTemps` | Freezing Temperatures | Thermometer | Temperature ≤ 0°C in ghost room |
| `fingerprints` | Fingerprints | UV Flashlight | UV cone reveals pre-seeded decals |
| `ghostOrbs` | Ghost Orbs | Night Vision Goggles | Floating orb particles appear in ghost room while NVG active |
| `spiritBox` | Spirit Box | Spirit Box | Ghost responds to questions while player is alone in ghost room |
| `writing` | Ghost Writing | Notebook | Ghost writes in a placed notebook in the ghost room |

**Motion Sensor** (`motionSensor`) — ghost-room locator only; does **not** appear in any ghost's evidence list.

### 6.2 Tool Specifications (7 tools, keys 1–7)

#### EMF Reader (key `1`)
- Receives `evidence:emf { level }` every 3–5 s. EMF 1: background. EMF 2: ghost room. EMF 5: ghost room + ghost has `emf5` evidence (30% chance).
- Current level shown on device and in HUD tool readout. **No popups.**

#### Thermometer (key `2`)
- Receives `evidence:temperature { temp }` every 2 s. Ghost room: −10 to +5°C. Other rooms: 15–20°C.
- Below 0°C: frost vignette overlay activates. **No popups.**

#### Night Vision Goggles (key `3`, toggle)
- Applies full-screen green-tint shader pass (ShaderPass with `uActive` uniform).
- While active in ghost room with `ghostOrbs` evidence: server emits `evidence:ghostOrbs`; client spawns 30 upward-drifting particles. **No popups.**

#### UV Flashlight (key `4`)
- Activates a narrow violet SpotLight from the camera.
- Fingerprint decals revealed when within UV cone (dot-product check, distance ≤ 4 m). **No popups.**

#### Notebook (key `5`, placeable)
- Press `E` to place. If placed in ghost room, after 10–20 s: `evidence:writing` emitted; notebook glows orange.
- Only 1 per player. **No popups.**

#### Motion Sensor (key `6`, placeable)
- Indicator light white (idle) → red (triggered) when ghost is in same room.
- Visible on Map Tablet as dots. Does **not** confirm journal evidence.

#### Spirit Box (key `7`)
- Press `E` to open question menu (5 questions).
- Responds only if player is alone in ghost room AND ghost has `spiritBox` evidence.
- Response displayed top-left for 4 s. **No popups.**

---

### 6.3 Shade Special Rule

If the active ghost is **Shade**, all evidence events are suppressed whenever **2 or more living players are in the ghost room simultaneously**.

---

## 7. Ghost Types

All 14 ghost types and their properties:

| Ghost | Evidence 1 | Evidence 2 | Evidence 3 | Special Ability |
|---|---|---|---|---|
| Banshee | EMF 5 | Freezing Temps | Fingerprints | None |
| Demon | Freezing Temps | Spirit Box | Writing | None |
| Mare | Freezing Temps | Ghost Orbs | Spirit Box | None |
| Spirit | Spirit Box | Writing | Fingerprints | None |
| Poltergeist | Spirit Box | Fingerprints | Ghost Orbs | None |
| Jinn | EMF 5 | Ghost Orbs | Spirit Box | **Faster when power is off** (speed 1.7 → 4.2 m/s) |
| Shade | EMF 5 | Writing | Ghost Orbs | **Withholds all evidence if ≥ 2 players in ghost room** |
| Yurei | Freezing Temps | Ghost Orbs | Writing | None (increased sanity drain: +0.2%/s) |
| Oni | EMF 5 | Spirit Box | Writing | None |
| Revenant | EMF 5 | Writing | Fingerprints | **Speed varies with distance** (3.0 m/s when > 5 m away, 1.0 m/s when ≤ 5 m) |
| Phantom | EMF 5 | Freezing Temps | Ghost Orbs | **Sanity drains +1.5%/s** while player looks at ghost during hunt |
| Wendigo | Fingerprints | Freezing Temps | Spirit Box | **Faster when nearest player's sanity < 30%** (speed 1.7 → 4.2 m/s) |
| Upyr | EMF 5 | Freezing Temps | Spirit Box | **Permanently gains +0.8 m/s** each time a player dies |
| Egui | Ghost Orbs | Writing | Spirit Box | **Faster when nearest player holds a specific item** (random per session; speed 1.7 → 4.2 m/s) |

**Base hunt speed for all ghosts without active modifier:** 1.7 m/s

---

## 8. Power System

- The **Boiler Room** contains a **fuse box** interactive object.
- Press `E` within 2.5 m of the fuse box to toggle house power on/off.
- **Power off:** All room lights go dark (transition 0.5 s); night vision goggles become essential.
- **Jinn ability activates** when power is off (speed boost during hunts).
- Power state is shared across all players and broadcast via `event:powerToggle`.

---

## 9. Evidence Journal

Opened with `J`. Does **not** pause the game.

**Left column — Evidence checklist:**
- 6 rows (one per evidence type). Each cycles: Unknown (?) → Confirmed (✓) → Ruled Out (✗).
- Players must **manually confirm evidence** after detecting it with tools.

**Right column — Ghost list (auto-elimination):**
- 14 ghost names. Ghosts without all confirmed evidence are automatically struck through.
- A ghost is a **candidate** if all confirmed evidence is in its 3-evidence list and none of its ruled-out evidence matches.
- Sole candidate pulses red.

**Submit button:**
- Enabled when ≥ 1 candidate remains.
- Correct: win screen shown to all. Incorrect: private notification to submitter; game continues.

---

## 10. Map Tablet

Opened with `M`. Shows a 2D floor plan of the current floor.

- Floor selector (Ground / Top / Basement).
- Placed motion sensors: white dots (idle), pulse red (triggered).
- Closes automatically if a hunt starts.

---

## 11. HUD Layout

```
┌──────────────────────────────────────────────────────────────┐
│ Spirit Box response / evidence popups              #SESSION   │
│                    [ HUNT WARNING ]                           │
│                                                              │
│                         3D VIEWPORT                          │
│                                                              │
│                              +   ← crosshair                 │
│              [Press E to ...]  ← context-sensitive prompt    │
│                                                              │
│ SANITY: 73%  ████████░░   [1][2][3][4][5][6][7]   Room Name │
│                            EMF: 2 / Temp: 3.2°C             │
└──────────────────────────────────────────────────────────────┘
```

| Element | Position | Content |
|---|---|---|
| Spirit Box response | Top-left | Ghost phrase, 4 s display |
| Evidence popups | Top-left | Tool detection notifications |
| Hunt warning | Top-centre | Countdown / "HUNT IN PROGRESS" |
| Session ID | Top-right | `#XXXXX` |
| Crosshair | Centre | `+` |
| Interact prompt | Bottom-centre | Context-sensitive `[E]` prompt |
| Sanity | Bottom-left | Percentage + colour bar |
| Tool hotbar | Bottom-centre | 7 slots (keys 1–7), active slot highlighted |
| Tool readout | Above hotbar | Current tool reading (EMF level, temperature) |
| Room name | Bottom-right | Current room |
| Temperature | Bottom-right | Shown when thermometer is held |

---

## 12. End Conditions

| Condition | Result |
|---|---|
| Correct ghost identified | **Win** — ghost type, ghost room, and solver revealed to all |
| Incorrect guess submitted | Game continues (private notification to submitter only) |
| All players dead | **Loss** — ghost type and ghost room revealed to all |

---

## 13. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Player position update rate | 20 Hz (client → server) |
| Ghost position broadcast rate | 10 Hz (server → clients, hunt only) |
| Max session size | 4 players |
| Frame rate target | 60 fps at 1080p on mid-range GPU |
| Network transport | WebSocket (ws library, LAN-only) |
| Browser support | Chrome 90+, Firefox 88+, Edge 90+ (Pointer Lock API required) |
| Server environment | Node.js 18 LTS or later |
| Deployment | `npm install` + `npm start` (game server) + `npm run dev` (Vite) |
| Anti-cheat | Ghost room ID never transmitted to client; ghost position not broadcast outside of hunts |

---

## 14. Keyboard Controls Reference

| Key | Action |
|---|---|
| W A S D | Move |
| Mouse | Look (requires pointer lock) |
| Click | Lock pointer (start looking) |
| `1` | Equip EMF Reader |
| `2` | Equip Thermometer |
| `3` | Equip / toggle Night Vision Goggles |
| `4` | Equip UV Flashlight |
| `5` | Equip Notebook |
| `6` | Equip Motion Sensor |
| `7` | Equip Spirit Box |
| `E` | Interact (place item / hide in closet / read notebook / toggle power / exit closet) |
| `G` | Drop held item |
| `J` | Toggle Evidence Journal |
| `M` | Toggle Map Tablet |
| `Esc` | Close open overlay / release pointer lock |

---

## 15. Out of Scope (v1.2)

- Player avatar rendering (other players' positions sync but not visually displayed yet)
- Voice chat between players
- Persistent accounts or match history
- Mobile or touch support
- Positional audio
- Custom maps or house editor
- Spectator ability to speak or signal to living players
- Ghost animations beyond position interpolation
- In-game tutorial or guided mode
- Online multiplayer (LAN only)
- Player count display on HUD (session ID shown; player count not yet broadcast)

---

## 16. Open Questions

| # | Question | Priority |
|---|---|---|
| 1 | Should incorrect guesses eventually lock the player out (penalty)? | Low |
| 2 | Should sanity affect visual distortion (post-processing) below a threshold? | Medium |
| 3 | Should ghost orbs be visible without NVG at very low sanity? | Low |
| 4 | Should the Egui's trigger item be shown to players somewhere as a hint? | Medium |
| 5 | Should there be a time limit per investigation beyond sanity drain? | Low |
| 6 | When should player avatars render in the 3D world for LAN multiplayer? | High |
| 7 | Should camera monitoring system in van allow viewing other players' first-person view? | Medium |

---

## 17. Known Limitations (v1.2 Beta)

- **No player avatars:** Other players' positions and state are synced server-side but not rendered in the 3D world.
- **No shared lobby display:** Player names and counts are not yet broadcast to other players' lobbies (HUD shows session ID only, not player count).
- **LAN-only:** No internet multiplayer; requires all players on the same local network.
- **Session visibility:** Players must manually share the LAN IP to join (no session discovery UI).
- **Requires npm:** Vite dev server must be running for Three.js module resolution; not a pure static file anymore.

---

## 18. Roadmap (v1.3+)

- Implement PlayerRenderer to display other players as 3D avatars in the world
- Add shared player list in lobby with live join notifications + HUD player count
- Implement camera monitoring system in van (view other players' feeds)
- Optional: Online multiplayer via cloud relay or public server
- Optional: Account persistence and match history
