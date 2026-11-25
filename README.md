# morbeo

Games, remakes and small tools. Everything runs in the browser, no backend or build step.
Live site: https://morbeo.github.io/

## Projects

| Project | What it is |
| --- | --- |
| [stick2](https://morbeo.github.io/stick2/) | Procedural stick-figure fight engine with a character designer, animation and sound effects editors, fight recording and replay (edit scenes and resume from any point), MCP support and multiplayer (needs more testing). |
| [viktorani](https://morbeo.github.io/viktorani/) | Bar trivia PWA with WebRTC multiplayer and buzzers. Works offline, supports QR codes and mobile. |
| [remakes](https://morbeo.github.io/remakes/) | Browser remakes of classic games, such as Spring Rider (Elasto Mania), Clockwerx, Heatline MX (Excitebike), Polar Delve (Arctic Adventure) and Virtua Justice (Virtua Cop). |
| [kocmoc](https://morbeo.github.io/kocmoc/) | Cel-shaded space sim and racer with 6DOF flight, procedural obstacle courses, twelve alien race tracks, replays and gamepad support. |
| [tools](https://morbeo.github.io/tools/) | Small browser utilities, listed below. |

## Tools

Source lives in [`tools/`](tools/). Each tool is a self-contained folder.

| Tool | Folder | Description |
| --- | --- | --- |
| [PS5 Controller Debugger](https://morbeo.github.io/tools/pad/) | `tools/pad/` | Test a DualSense: buttons, sticks, triggers, circularity, deadzones, rumble, touchpad, mic and speaker, plus a fighting-game move detector. |
| [Enigma I Simulator](https://morbeo.github.io/tools/enigma/) | `tools/enigma/` | Encode and decode with a three-rotor Enigma I and step through each keypress: plugboard, rotors, double step and reflector. |
| [Guitar Theory Lab](https://morbeo.github.io/tools/guitar/) | `tools/guitar/` | Scales, modes, intervals and an arpeggiator on a fretboard for guitar, bass and ukulele, plus a tuner with microphone pitch detection. |
| [Anagram Maker](https://morbeo.github.io/tools/anagram/) | `tools/anagram/` | Shuffle, sort or reverse the letters of a phrase, or drag them into place by hand. |
| [Mahjong Scorer](https://morbeo.github.io/tools/mahjong/) | `tools/mahjong/` | Pick the tiles of a winning hand and see patterns and payments under Riichi, Hong Kong, MCR, Chinese New Style, Chinese Classical and Taiwanese rules. |
| [Nacre Generator](https://morbeo.github.io/tools/nacre/) | `tools/nacre/` | Procedural mother of pearl from thin-film interference, shown flat or ray-marched on a sphere, torus or cube, with presets, lighting and PNG export. |

To add a tool, create `tools/<name>/index.html` and copy a block in `tools/index.html`.

## Checks

CI (`.github/workflows/checks.yml`) runs on every pull request and push to `main`:

```bash
node --test tests/*.test.js   # Mahjong hand parsing and scoring rules
python3 tests/smoke.py        # loads every page, fails on errors (needs: pip install playwright)
```
