# Escape the Desk

A side-view pixel art game made by Matt and his son. You're Timothy the pencil, and you have to get off either end of the school desk before the kid's hands grab you.

## Play it

Open `index.html` in any web browser. There's nothing to install.

## Controls

| Key | Standing up | Lying down |
| --- | --- | --- |
| Left / Right | Walk | Roll (keeps its speed) |
| Up | Jump | Stand back up |
| Down | Tip over (or sharpen, at the sharpener) | |
| Space | Stab a hand with your tip | Stand up and stab |
| R | Restart | Restart |
| M | Sound on or off | |

Each stab makes Timothy duller and slower. The sharpener makes him sharp again, but sharpening when he's already sharp just makes him shorter, and shorter pencils jump lower.

## The hands

- **Slam:** a shadow appears, then the hand comes straight down.
- **Dive:** dots show the path, then the hand swoops in from a top corner.
- **Swipe:** the hand drops in beside Timothy and sweeps across. Jump a low swipe, lie down under a high one. Books, the eraser and the pencil cup block it.
- **Guard:** the hand sits on one end of the desk for a few seconds.

## Where things are

- `index.html`: the page around the game.
- `src/game.js`: the whole game. The level layout is in `LEVEL`, the feel (speeds, jump height, warning time) is in `TUNE`, and every colour is in `PAL`.
