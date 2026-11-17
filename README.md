# Relay

A countdown lock screen for team projects. One lap is the whole project, each teammate runs one leg,
and the baton moves every day. Every teammate gets their own lock screen, and the baton is in the same
spot on all four.

**Live:** https://arshdwani.github.io/relay-countdown/

## How it works
- **One lap = the project.** With 20 days, the baton moves 20 m a day; the infield counts down to the
  submit time.
- **One leg each.** Your leg is outlined, your status is in plain words ("Warm-up day", "You have the
  baton", "Hand off tomorrow morning"), and the screen shows today's task for whoever has the baton.
- **Real takeover zones.** In a 4×100 m relay the zone is 30 m, from 20 m before the scratch line to
  10 m after it. Here that is one day of warm-up for the next runner and half a day of standby for the
  last one, so no handoff is cold.

## Use it for your team
Open the page, fill in **Use it for your team** (project, day 1, due date, four leg names) and press
**Make our race**. The plan is stored in the link, so send it to the group: everyone picks their leg and
downloads their own screens (one day as PNG, or every day as a zip, for iPhone or Android).

To change it every morning on iPhone: put the unzipped `Relay` folder in `iCloud Drive/Shortcuts`, then
Shortcuts → Automation → Time of Day (daily) → Current Date → Format Date `yyyy-MM-dd` →
Get File `Relay/[Formatted Date].png` → Set Wallpaper Photo (Lock Screen).

## Files
- `relay.js`: the whole design as one SVG generator (`renderRelay`), used by the page preview, the PNG
  export and the renders.
- `plan.js`: the example plan.
- `index.html`: the page. `frame.html?date=YYYY-MM-DD&leg=1..4&w=1290&h=2796&clock=1` renders one frame.
- `cover.html`: the four-phone cover.

## Credits
- The example plan (legs, daily tasks, what each handoff passes on) and the stadium painting were made
  with Gemini. The painting keeps Gemini's mark.
- Takeover-zone rule: World Athletics technical rules for 4×100 m relays.
- Type: Barlow and Barlow Condensed by The Barlow Project Authors, SIL Open Font License 1.1
  (`fonts/OFL.txt`).
- Code: MIT (`LICENSE`).
