# Ghost Detectives — Product Requirements Document

**Version:** 1.0  
**Date:** 2026-05-07  
**Status:** In Development

---

## 1. Product Overview

Ghost Detectives is a browser-based 3D first-person online multiplayer horror game. Up to four players enter a haunted Victorian house (Whittaker House) and work together to identify which of 14 ghost types haunts it. Evidence is gathered using paranormal investigation tools. Players must correctly identify the ghost type before their sanity runs out or the ghost kills the entire team.

---

## 2. Goals

- Deliver a playable multiplayer horror investigation game in the browser with no install required.
- Provide tense cooperative gameplay through a sanity system, random hunt events, and ghost special abilities.
- Ensure ghost identity is never trivially obtainable — it must be deduced from gathered evidence.
- Support 1–4 players per session with real-time synchronisation.

---

## 3. Platform & Tech Stack

| Layer | Technology |
|---|---|
| Client rendering | Three.js (WebGL, first-person 3D) |
| Client language | JavaScript (ES Modules, Vite-bundled) |
| Server | Node.js + Express |
| Real-time communication | Socket.io |
| Audio | Howler.js |
| Build tool | Vite |

**Target:** Modern desktop browsers (Chrome, Firefox, Edge). Pointer Lock API required for mouse-look.

---

## 4. Player Flow

```
Browser → Lobby (enter name) → Wait for host → Host starts game
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
| Session creation | Auto-created when first player joins; new session created if existing ones are full |
| Host | First player to join; only host can press Start |
| Lobby display | All connected player names shown; session ID shown top-right |
| Game cannot start with | 0 players |

### 5.2 House — Whittaker House

The house has 3 floors and 17 named spaces. Players navigate between floors via stairwell trigger zones.

**Ground Floor:**
| Room ID | Name | Ghost Eligible |
|---|---|---|
| foyer | Foyer | No (spawn + exit point) |
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

**Ghost room selection:** One ghost-eligible room is randomly selected per session. All evidence events only fire when players are inside that room. The ghost room ID is **never sent to the client** — players must infer it from evidence.

**Ghost room detection tools (non-evidence):**
- EMF reader reads **EMF 2** anywhere in the ghost room (vs. EMF 1 elsewhere)
- Thermometer reads **≤ 5°C** in the ghost room (vs. 15–20°C elsewhere)
- Motion sensor flashes red when placed in the ghost room

**Floor transitions:** When a player enters a stairwell and reaches the far trigger boundary, they are teleported to the destination floor's landing room.

**Closets:** Every room has one closet (a specific position in a corner). Players can hide there during hunts by pressing `E` within 1.2 m of the closet position.

**Exit door:** On the south wall of the Foyer. Locked for all players during active hunts.

---

### 5.3 Player

| Property | Detail |
|---|---|
| Perspective | First-person (PointerLockControls) |
| Movement | WASD, mouse-look (yaw + pitch), no jumping |
| Speed | 4.5 m/s |
| Collision | Per-axis AABB against solid walls; doorways between connected rooms are always open |
| Starting position | Foyer centre at world coordinates (0, 1.7, 0) |
| Camera height | 1.7 m above floor |

**Player states:**

| State | Effect |
|---|---|
| Normal | Full movement, tools usable |
| Hiding | Teleported to closet position; no movement; ghost cannot target or kill |
| Dead | No movement or tools; spectator camera mode enabled |
| Spectator | Free-cam, no collision, no tools; can view map tablet |

---

### 5.4 Sanity

| Property | Detail |
|---|---|
| Starting value | 100% |
| Passive drain | 0.3% per second (per living, non-hiding player) |
| Yurei bonus drain | +0.2% per second additional |
| Phantom drain | +0.5% per second extra while looking at the ghost during a hunt |
| Minimum | 0% |
| Display | Shown only to the local player (bar + percentage, bottom-left HUD) |
| Team average sanity | Computed server-side only; used for hunt interval calculation |

---

### 5.5 Hunt System

| Property | Detail |
|---|---|
| Hunt trigger interval | `120 − ((100 − teamAvgSanity) × 0.8)` seconds, minimum 30 s |
| Pre-hunt warning | 10 seconds before each hunt; "HUNT IN Xs" displayed centre-top |
| Hunt duration | 30 seconds |
| Effects on start | Exit door locks; ghost becomes visible; ghost chases nearest living non-hiding player |
| Effects on end | Ghost becomes invisible; exit door unlocks; player hiding state cleared |
| Hiding | Player presses `E` within 1.2 m of any closet → teleported to closet position; immune to ghost |
| Player death | Ghost reaches within 0.8 m of a non-hiding player → player dies; spectator mode activates |
| All players dead | Game immediately ends with a loss result |

---

### 5.6 Ghost AI

- During **investigation phase**: ghost wanders the room graph every 20–30 s (invisible to players; position used only for proximity-based evidence calculations).
- During **hunt phase**: ghost uses BFS on the room graph to pathfind toward the nearest living, non-hiding player. Position is broadcast to clients at 10 Hz. Clients interpolate ghost position (lerp factor 0.15 per frame).
- Ghost position and identity are **never sent to clients outside of a hunt** — only the visible flag and current position during hunts.

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

**Motion Sensor** (`motionSensor`) — ghost-room locator only; does **not** appear in any ghost's evidence list and is not used for journal narrowing.

### 6.2 Tool Specifications

#### EMF Reader (key `1`)
- Handheld; held in the player's hand view.
- Receives server event `evidence:emf { level }` every 3–5 s.
- EMF 1: background (any room). EMF 2: ghost room (always). EMF 5: ghost room, only if ghost has `emf5` evidence (30% chance per server tick).
- Display: current level shown on device and in HUD tool readout in real-time.
- **No popups.** Players must actively watch the EMF readout to catch level 5 spikes and manually confirm evidence in the journal.

#### Thermometer (key `2`)
- Handheld.
- Receives `evidence:temperature { temp }` every 2 s for the player's current room.
- Ghost room: −10 to +5°C. Other rooms: 15–20°C.
- Below 0°C: frost vignette overlay activates.
- Temperature always visible in HUD tool readout while thermometer is held.
- **No popups.** Players must actively watch the thermometer display to catch freezing temperatures and manually confirm evidence in the journal.

#### Night Vision Goggles (key `3`, toggle)
- Toggle on/off; applies a full-screen green-tint shader pass.
- While active AND player is in ghost room AND ghost has `ghostOrbs` evidence: server emits `evidence:ghostOrbs { active: true }` every 4 s; client spawns 30 upward-drifting point particles.
- Ghost orbs are only visible while NVG is active.
- **No popups.** Players must be looking at the screen to see ghost orbs appear and manually confirm evidence in the journal.

#### UV Flashlight (key `4`)
- Handheld; activates a narrow violet SpotLight from the camera.
- Fingerprint positions are pre-seeded server-side at game start (empty array if ghost has no `fingerprints` evidence) and sent to all clients.
- Fingerprint decals are invisible by default; revealed when they fall within the UV cone (dot-product check, distance ≤ 4 m).
- **No popups.** Players must actively scan rooms with the UV light to find fingerprints and manually confirm evidence in the journal.

#### Notebook (key `5`, placeable)
- Press `E` to place on the floor in the player's facing direction.
- Once placed in ghost room and 10–20 s elapse: server emits `evidence:writing { notebookId, message }`.
- Notebook animates to an orange glow; press `E` near notebook to read the message.
- **No popups.** Players must actively monitor placed notebooks and manually confirm evidence in the journal.
- Only 1 notebook per player; re-pressing `5` shows "already placed" state.

#### Motion Sensor (key `6`, placeable)
- Press `E` to place; indicator light glows white when idle.
- Server checks every 5–10 s whether the sensor is in the ghost room; if yes, emits `evidence:motionSensor { sensorId, active: true }` for 1–2 s.
- Sensor indicator light turns **red** while active.
- All placed sensors visible on the Map Tablet (`M` key) as dots (white = idle, red = triggered).
- Detection of motion does **not** auto-confirm any journal evidence (it only reveals the ghost room location).

#### Spirit Box (key `7`)
- Handheld; press `E` to open the question menu (5 pre-written questions).
- Questions: "Are you here?", "What do you want?", "How did you die?", "Are you angry?", "Did you die here?"
- Response conditions (all must be true): player is in ghost room, player is alone in ghost room, ghost has `spiritBox` evidence.
- Response displayed top-left of screen for 4 s.
- **No popups.** Players must be watching the top-left to see responses and manually confirm evidence in the journal.

---

### 6.3 Shade Special Rule

If the active ghost is **Shade**, the server suppresses **all** evidence events (EMF, temperature spikes, orbs, writing, spirit box responses) whenever **2 or more living players are in the ghost room simultaneously**. Players must split up to gather Shade evidence.

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
| Revenant | EMF 5 | Writing | Fingerprints | **Speed varies with player distance** (3.0 m/s when > 5 m away, 1.0 m/s when ≤ 5 m) |
| Phantom | EMF 5 | Freezing Temps | Ghost Orbs | **Sanity drains +0.5%/s** while player looks at ghost during hunt |
| Wendigo | Fingerprints | Freezing Temps | Spirit Box | **Faster when nearest player's sanity < 25%** (speed 1.7 → 4.2 m/s) |
| Upyr | EMF 5 | Freezing Temps | Spirit Box | **Permanently gains +0.8 m/s** each time a player dies |
| Egui | Ghost Orbs | Writing | Spirit Box | **Faster when nearest player holds a specific item** (random per session; speed 1.7 → 4.2 m/s) |

**Base hunt speed for all ghosts without active modifier:** 1.7 m/s

---

## 8. Power System

- The **Boiler Room** contains a **fuse box** interactive object.
- Press `E` within 2.5 m of the fuse box to toggle house power on/off.
- **Power off:** All room lights go dark (transition 0.5 s); night vision goggles become essential.
- **Jinn ability activates** when power is off (speed boost during hunts).
- Power state is shared across all players in the session and broadcast via `event:powerToggle`.

---

## 9. Evidence Journal

Opened with `J`. Does **not** pause the game (ghost can still hunt while reading).

**Left column — Evidence checklist:**
- One row per evidence type (6 rows).
- Each row cycles through 3 states on click: Unknown (?) → Confirmed (✓) → Ruled Out (✗).
- Players must **manually confirm evidence** after detecting it with tools. Tools display detection data in real-time HUD readouts with no popups or notifications.

**Right column — Ghost list (auto-elimination):**
- All 14 ghost names listed.
- When a player confirms evidence, all ghosts that **do not have that evidence** are **automatically eliminated** (struck through, greyed).
- A ghost is a **candidate** (white, highlighted) if:
  - ALL confirmed evidence types are in its 3 evidence types, AND
  - NONE of the ruled-out evidence types are in its 3 evidence types.
- If exactly 1 candidate remains, it pulses red as the sole suspect.

**Submit button:**
- Enabled when ≥ 1 candidate remains.
- If multiple candidates remain, player must click the specific ghost name to select it.
- Sends `game:submitGuess { ghostId }` to server.
- **Correct:** end screen shown to all players (win).
- **Incorrect:** private "incorrect" notification to submitter only; game continues.

---

## 10. Map Tablet

Opened with `M`. Shows a 2D floor plan of the current floor.

- Floor selector (Ground / Top / Basement) allows switching views.
- Placed motion sensors appear as white dots.
- Actively triggered sensors pulse red.
- Closes automatically if a hunt starts.

---

## 11. HUD Layout

```
┌──────────────────────────────────────────────────────────────┐
│ Spirit Box response / evidence popups    Players: N/4  #ID   │
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
| Player count | Top-right | `Players: N/4` |
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
| Network transport | WebSocket via Socket.io |
| Browser support | Chrome 90+, Firefox 88+, Edge 90+ (Pointer Lock API required) |
| Server environment | Node.js 18 LTS or later |
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
| `J` | Toggle Evidence Journal |
| `M` | Toggle Map Tablet |
| `Esc` | Close open overlay / release pointer lock |

---

## 15. Out of Scope (v1.0)

The following features are explicitly excluded from the initial version:

- Voice chat between players
- Persistent accounts or match history
- Mobile or touch support
- 3D character models (players and ghost use placeholder geometry)
- Positional audio (Howler.js integration planned for v1.1)
- Custom maps or house editor
- Spectator ability to speak or signal to living players
- Ghost animations beyond position interpolation
- In-game tutorial or guided mode

---

## 16. Open Questions

| # | Question | Priority |
|---|---|---|
| 1 | Should incorrect guesses eventually lock the player out (penalty)? | Low |
| 2 | Should sanity affect visual distortion (post-processing) below a threshold? | Medium |
| 3 | Should ghost orbs be visible without NVG at very low sanity? | Low |
| 4 | Should the Egui's trigger item be shown to players somewhere as a hint? | Medium |
| 5 | Should there be a time limit per investigation beyond sanity drain? | Low |
