# Simple Tile - Window Tiling for Cinnamon

A lightweight, fluid Cinnamon Desktop extension for intuitive window tiling and layout management in Linux Mint and Cinnamon Desktop environments.

---

## ✨ Features

- 🪟 **Drag-to-Top Tiling Bar**: Drag any window toward the top edge of your monitor to smoothly slide down the Simple Tile bar with preset layout templates.
- 🎯 **Live Tile Previews**: Hovering over any zone inside the bar displays a translucent accent preview on your desktop showing the exact bounding area.
- ⚡ **Instant Snapping**: Release your mouse over any zone to snap the window directly into that predetermined space with native audio feedback.
- ⌨️ **Keyboard Shortcut**: Optionally configure a hotkey to trigger the interactive tiling overlay for the focused window without dragging.
- 🖥️ **Full Multi-Monitor Support**: Works seamlessly across multiple monitors, detecting cursor position and placing the tiling bar and preview on the correct display.
- 📐 **Panel & Dock Aware**: Automatically queries work area geometry to respect top panels, bottom panels, and docks without overlapping.
- 🎨 **Clean Aesthetics & Customization**:
  - Frosted glass container with rounded bottom corners and subtle borders.
  - Customizable accent color with live preview and zone highlights.
  - Adjustable window padding / gaps (from 0px flush tiling to modern 4–8px spacing).
  - Configurable trigger distance from the screen edge.
  - Toggle individual layouts on or off in settings.

---

## 📐 Included Layout Templates

| Layout | Name | Description |
| :---: | :--- | :--- |
| **1** | **50 / 50 Split** | Two equal vertical columns |
| **2** | **67 / 33 Priority Left** | Large left focus pane (2/3) and right sidebar (1/3) |
| **3** | **3 Equal Columns** | Three equal columns (1/3 each) |
| **4** | **4 Quadrants Grid** | 2x2 grid (Top-Left, Top-Right, Bottom-Left, Bottom-Right) |
| **5** | **Center Focus** | 25% left sidebar, 50% center workspace, 25% right sidebar |

---

## 🚫 Disabling Cinnamon's Default Snapping

To avoid having Cinnamon's default snapping (which maximizes or tiles windows when dragging to edges) compete with Simple Tile:

### Option A: Via Command Line (Instant)
```bash
gsettings set org.cinnamon.muffin edge-tiling false
```

### Option B: Via Cinnamon Settings
1. Open **Menu → System Settings → Windows**.
2. Click on the **Tiling** tab.
3. Turn **OFF** the switch: **"Enable window tiling"**.

*(If you ever want to re-enable Cinnamon's default tiling, toggle the switch back ON or run `gsettings set org.cinnamon.muffin edge-tiling true`)*.

---

## 🚀 Quick Installation

Clone or open the repository directory and run the installer script:

```bash
cd ~/Repos/CinnWin
./install.sh
```

The script will symlink the extension into `~/.local/share/cinnamon/extensions/simple-tile@maciej`, register it in Cinnamon's `enabled-extensions`, migrate existing settings if upgrading, and reload the Cinnamon session automatically.

### Helper Commands:

```bash
# Reload the extension in your active Cinnamon session
./install.sh --reload

# Install as copied files rather than a development symlink
./install.sh --copy

# Temporarily disable the extension
./install.sh --disable

# Re-enable the extension
./install.sh --enable

# Uninstall completely
./install.sh --uninstall
```

---

## 🎮 How to Use

1. Grab any window by its titlebar with your mouse.
2. Drag it toward the **top edge** of any screen (or press your configured keyboard shortcut).
3. The **Simple Tile Bar** drops down smoothly from the top, directly above your cursor.
4. Move your cursor over one of the miniature zones in any layout template.
5. A translucent preview rectangle illuminates the screen area where the window will land.
6. **Release the mouse button** to snap the window into that space!
7. If you change your mind, simply drag the window away from the top bar back into the desktop and the bar will slide back up.

---

## ⚙️ Configuration & Settings

You can adjust all options natively in **System Settings** -> **Extensions** -> **Simple Tile** -> **Configure (Gear icon)**:

- **Trigger distance**: Pixels from the top screen edge required to drop down the tile bar (default: `40px`–`60px`).
- **Window gap**: Spacing between tiled windows and screen edges (default: `4px`, set to `0px` for flush edge-to-edge tiling).
- **Keyboard shortcut**: Optional shortcut key to display Simple Tile for the active window without dragging (unassigned by default).
- **Accent color**: Highlight color for active zones and screen preview.
- **Play sound**: Audio feedback when a window snaps into place.
- **Enable/disable individual layouts**: Show only the layouts you use most often.

---

## 📜 License

MIT License. Feel free to use, modify, and distribute.
