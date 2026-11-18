# [stick2](https://morbeo.github.io/stick2/)

vibe coded procedural stick figure fight engine

- character designer
- animation editor
- sound effects editor
- record fights, replay in editor, edit scenes and resume fight from arbitrary point
- MCP support
- multiplayer support (needs more testing)

# [viktorani](https://morbeo.github.io/viktorani/)

bar trivia PWA app

- mobile support
- offline mode
- qr code support

# [remakes](https://morbeo.github.io/remakes)

### spring rider (elasto mania)

### clockwerx

### heatline mx (excitebike)

### polar delve (arctic adventure)

# [tools](https://morbeo.github.io/tools/)

Small browser-based utilities. Everything runs locally in the browser.

| Tool | Description | Live URL |
| --- | --- | --- |
| PS5 Controller Debugger | Test a DualSense: buttons, sticks, triggers, circularity, deadzones, rumble, touchpad, mic and speaker, plus a fighting-game move detector. | https://morbeo.github.io/tools/pad/ |
| Enigma I Simulator | Encode and decode with a three-rotor Enigma I, then step through each keypress with a signal path diagram. | https://morbeo.github.io/tools/enigma/ |
| Guitar Theory Lab | Scales, modes, intervals and an arpeggiator on a fretboard for guitar, bass and ukulele, plus a tuner with microphone pitch detection. | https://morbeo.github.io/tools/guitar/ |
| Anagram Maker | Shuffle, sort or reverse the letters of a word or phrase, or drag them into place by hand. | https://morbeo.github.io/tools/anagram/ |
| Mahjong Scorer | Pick the tiles of a winning hand and see which patterns score and what each player pays under several rule sets. | https://morbeo.github.io/tools/mahjong/ |

## Adding a tool

1. Create `tools/<name>/index.html` as a self-contained page (doctype, charset and viewport meta; no build step).
2. Add a card to `tools/index.html`: copy an existing `<a class="tool">` block and update the `href`, name, `/tools/<name>/` path and description.
3. Add a row to the table above.
4. Push to the default branch; GitHub Pages serves it at `https://morbeo.github.io/tools/<name>/`.
