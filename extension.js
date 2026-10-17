// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
//
// Simple Tile - Window Tiling for Cinnamon
//
// Author: maciej
// Description: Simple Tile provides an intuitive, unobtrusive drop bar and shortcut
// for tiling windows into clean layout templates in Cinnamon.

const { Clutter, St, Meta, GLib, Gio } = imports.gi;
const Main = imports.ui.main;
const Settings = imports.ui.settings;

const LAYOUT_PRESETS = [
    {
        id: 'layout-two-equal',
        title: '50 / 50 Split',
        key: '1',
        zones: [
            { id: 'left', x: 0, y: 0, w: 0.5, h: 1.0, mini: { x: 0, y: 0, w: 34, h: 44 } },
            { id: 'right', x: 0.5, y: 0, w: 0.5, h: 1.0, mini: { x: 36, y: 0, w: 34, h: 44 } }
        ]
    },
    {
        id: 'layout-two-priority',
        title: '67 / 33 Priority Left',
        key: '2',
        zones: [
            { id: 'left', x: 0, y: 0, w: 0.6667, h: 1.0, mini: { x: 0, y: 0, w: 45, h: 44 } },
            { id: 'right', x: 0.6667, y: 0, w: 0.3333, h: 1.0, mini: { x: 47, y: 0, w: 23, h: 44 } }
        ]
    },
    {
        id: 'layout-three-equal',
        title: '3 Equal Columns',
        key: '3',
        zones: [
            { id: 'left', x: 0, y: 0, w: 0.3333, h: 1.0, mini: { x: 0, y: 0, w: 22, h: 44 } },
            { id: 'middle', x: 0.3333, y: 0, w: 0.3334, h: 1.0, mini: { x: 24, y: 0, w: 22, h: 44 } },
            { id: 'right', x: 0.6667, y: 0, w: 0.3333, h: 1.0, mini: { x: 48, y: 0, w: 22, h: 44 } }
        ]
    },
    {
        id: 'layout-four-grid',
        title: '4 Quadrants Grid',
        key: '4',
        zones: [
            { id: 'top-left', x: 0, y: 0, w: 0.5, h: 0.5, mini: { x: 0, y: 0, w: 34, h: 21 } },
            { id: 'top-right', x: 0.5, y: 0, w: 0.5, h: 0.5, mini: { x: 36, y: 0, w: 34, h: 21 } },
            { id: 'bottom-left', x: 0, y: 0.5, w: 0.5, h: 0.5, mini: { x: 0, y: 23, w: 34, h: 21 } },
            { id: 'bottom-right', x: 0.5, y: 0.5, w: 0.5, h: 0.5, mini: { x: 36, y: 23, w: 34, h: 21 } }
        ]
    },
    {
        id: 'layout-center-focus',
        title: 'Center Focus (25 / 50 / 25)',
        key: '5',
        zones: [
            { id: 'left', x: 0, y: 0, w: 0.25, h: 1.0, mini: { x: 0, y: 0, w: 16, h: 44 } },
            { id: 'center', x: 0.25, y: 0, w: 0.5, h: 1.0, mini: { x: 18, y: 0, w: 34, h: 44 } },
            { id: 'right', x: 0.75, y: 0, w: 0.25, h: 1.0, mini: { x: 54, y: 0, w: 16, h: 44 } }
        ]
    }
];

function parseRgb(colorStr) {
    if (!colorStr) return [0, 120, 212];
    colorStr = String(colorStr).trim();

    let rgbMatch = colorStr.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (rgbMatch) {
        let r = Math.min(255, Math.max(0, parseInt(rgbMatch[1], 10)));
        let g = Math.min(255, Math.max(0, parseInt(rgbMatch[2], 10)));
        let b = Math.min(255, Math.max(0, parseInt(rgbMatch[3], 10)));
        return [r, g, b];
    }

    let hex = colorStr.replace('#', '').trim();
    if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
    }
    if (hex.length >= 6) {
        let r = parseInt(hex.substring(0, 2), 16);
        let g = parseInt(hex.substring(2, 4), 16);
        let b = parseInt(hex.substring(4, 6), 16);
        if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
            return [r, g, b];
        }
    }

    return [0, 120, 212];
}

function colorToRgba(colorStr, alpha) {
    let [r, g, b] = parseRgb(colorStr);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function lightenColor(colorStr, factor = 0.3) {
    let [r, g, b] = parseRgb(colorStr);
    r = Math.min(255, Math.round(r + (255 - r) * factor));
    g = Math.min(255, Math.round(g + (255 - g) * factor));
    b = Math.min(255, Math.round(b + (255 - b) * factor));
    return `rgb(${r}, ${g}, ${b})`;
}

class TilePreview {
    constructor(manager) {
        this._manager = manager;
        this.actor = new St.Bin({
            style_class: 'simple-tile-preview',
            important: true,
            reactive: false,
            can_focus: false
        });
        this.actor.hide();
        this.actor.opacity = 0;

        Main.uiGroup.add_actor(this.actor);
        this._isShowing = false;
        this._currentRect = null;
    }

    show(rect) {
        if (!rect) return;

        let accent = this._manager.accentColor;
        let bg = colorToRgba(accent, 0.26);
        let border = colorToRgba(accent, 0.88);
        this.actor.set_style(`background-color: ${bg}; border: 2px solid ${border}; border-radius: 10px;`);

        this._currentRect = rect;
        this.actor.show();
        this.actor.remove_all_transitions();

        if (!this._isShowing) {
            this.actor.set_position(rect.x, rect.y);
            this.actor.set_size(rect.width, rect.height);
            this.actor.opacity = 0;
            this._isShowing = true;

            this.actor.ease({
                opacity: 255,
                duration: 120,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD
            });
        } else {
            this.actor.ease({
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                opacity: 255,
                duration: 140,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD
            });
        }
    }

    hide() {
        if (!this._isShowing) return;
        this._isShowing = false;
        this._currentRect = null;

        this.actor.remove_all_transitions();
        this.actor.ease({
            opacity: 0,
            duration: 100,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                this.actor.hide();
            }
        });
    }

    destroy() {
        this.actor.remove_all_transitions();
        if (this.actor.get_parent()) {
            this.actor.get_parent().remove_actor(this.actor);
        }
        this.actor.destroy();
    }
}

class SnapBar {
    constructor(manager) {
        this._manager = manager;
        this._zoneItems = [];
        this._cardActors = [];
        this._activeHoveredItem = null;
        this._isShowing = false;
        this._isInteractive = false;
        this._currentMonitor = null;

        this._cardWidth = 78;
        this._cardHeight = 52;
        this._innerPadX = 70;
        this._innerPadY = 44;

        this._buildUI();
    }

    _buildUI() {
        // Main container
        this.actor = new St.BoxLayout({
            style_class: 'simple-tile-bar',
            vertical: true,
            reactive: true,
            can_focus: true
        });

        // Top drag handle / indicator
        let handleBox = new St.BoxLayout({
            vertical: false,
            x_align: Clutter.ActorAlign.CENTER,
            style: 'margin-bottom: 8px;'
        });
        let handle = new St.Bin({
            style: 'width: 36px; height: 4px; background-color: rgba(255, 255, 255, 0.28); border-radius: 2px;'
        });
        handleBox.add_actor(handle);
        this.actor.add_actor(handleBox);

        // Cards container
        this._cardsContainer = new St.BoxLayout({
            vertical: false,
            style: 'spacing: 8px;'
        });
        this.actor.add_actor(this._cardsContainer);

        this.actor.hide();
        this.actor.opacity = 0;

        Main.layoutManager.addChrome(this.actor, {
            affectsStruts: false,
            affectsInputRegion: false,
            visibleInFullscreen: true
        });

        this.rebuildCards();
    }

    rebuildCards() {
        this._zoneItems = [];
        this._cardActors = [];
        this._cardsContainer.destroy_all_children();

        let enabledPresets = this._manager.getEnabledPresets();

        for (let i = 0; i < enabledPresets.length; i++) {
            let preset = enabledPresets[i];

            // Miniature screen card
            let cardActor = new St.Bin({
                style_class: 'simple-tile-card',
                width: this._cardWidth,
                height: this._cardHeight,
                reactive: true
            });

            // Zone container inside card
            let cardInner = new Clutter.Actor({
                width: this._innerPadX,
                height: this._innerPadY
            });
            cardActor.set_child(cardInner);

            // Create each zone tile
            for (let j = 0; j < preset.zones.length; j++) {
                let zone = preset.zones[j];
                let m = zone.mini || {
                    x: Math.round(zone.x * this._innerPadX),
                    y: Math.round(zone.y * this._innerPadY),
                    w: Math.round(zone.w * this._innerPadX),
                    h: Math.round(zone.h * this._innerPadY)
                };

                let tile = new St.Bin({
                    style_class: 'simple-tile-zone',
                    x: m.x,
                    y: m.y,
                    width: m.w,
                    height: m.h,
                    reactive: true
                });

                cardInner.add_actor(tile);

                let item = {
                    preset: preset,
                    zone: zone,
                    tileActor: tile,
                    cardActor: cardActor,
                    cardIndex: i,
                    zoneIndex: j
                };
                this._zoneItems.push(item);
            }

            this._cardsContainer.add_actor(cardActor);
            this._cardActors.push({ cardActor, preset });
        }
    }

    show(monitor, pointerX = null) {
        if (!monitor) return;

        let workArea = this._manager.getWorkArea(monitor);
        this.actor.set_width(-1);
        this.actor.set_height(-1);
        let [, naturalWidth] = this.actor.get_preferred_width(-1);
        let [, naturalHeight] = this.actor.get_preferred_height(naturalWidth);

        let targetX;
        if (typeof pointerX === 'number' && !isNaN(pointerX)) {
            let idealX = pointerX - Math.floor(naturalWidth / 2);
            let minX = workArea.x + 16;
            let maxX = workArea.x + workArea.width - naturalWidth - 16;
            targetX = Math.max(minX, Math.min(maxX, idealX));
        } else {
            targetX = workArea.x + Math.floor((workArea.width - naturalWidth) / 2);
        }
        let targetY = workArea.y;

        if (!this._isShowing) {
            this._currentMonitor = monitor;
            this.actor.set_position(targetX, targetY - naturalHeight - 12);
            this.actor.opacity = 0;
            this.actor.show();
            this._isShowing = true;

            this.actor.remove_all_transitions();
            this.actor.ease({
                x: targetX,
                y: targetY,
                opacity: 255,
                duration: 160,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD
            });
        } else if (this._currentMonitor !== monitor) {
            this._currentMonitor = monitor;
            this.actor.remove_all_transitions();
            this.actor.ease({
                x: targetX,
                y: targetY,
                opacity: 255,
                duration: 120,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD
            });
        }
    }

    hide(immediate = false) {
        if (!this._isShowing) return;
        this._isShowing = false;
        this.setHoveredItem(null);

        this.actor.remove_all_transitions();
        if (immediate) {
            this.actor.opacity = 0;
            this.actor.hide();
        } else {
            let targetY = this.actor.y - this.actor.height - 12;
            this.actor.ease({
                y: targetY,
                opacity: 0,
                duration: 140,
                mode: Clutter.AnimationMode.EASE_IN_QUAD,
                onComplete: () => {
                    this.actor.hide();
                }
            });
        }
    }

    isShowing() {
        return this._isShowing;
    }

    getActor() {
        return this.actor;
    }

    getActiveHoveredItem() {
        return this._activeHoveredItem;
    }

    setHoveredItem(item) {
        if (this._activeHoveredItem === item) return;

        // Clear previous highlight
        if (this._activeHoveredItem) {
            let prevTile = this._activeHoveredItem.tileActor;
            prevTile.remove_style_class_name('active');
            prevTile.set_style('');
            this._activeHoveredItem.cardActor.remove_style_class_name('hovered');
        }

        this._activeHoveredItem = item;

        // Apply new highlight
        if (this._activeHoveredItem) {
            let tile = this._activeHoveredItem.tileActor;
            tile.add_style_class_name('active');

            let accent = this._manager.accentColor;
            let border = lightenColor(accent, 0.4);
            tile.set_style(`background-color: ${accent}; border: 1px solid ${border};`);
            this._activeHoveredItem.cardActor.add_style_class_name('hovered');

            // Show Tile Preview
            let workArea = this._manager.getWorkArea(this._currentMonitor);
            let targetRect = this._manager.calculateZoneRect(workArea, this._activeHoveredItem.zone);
            this._manager.tilePreview.show(targetRect);

            // Suppress Cinnamon's native full-screen maximize preview if present
            if (Main.wm && Main.wm._tilePreview && Main.wm._tilePreview._showing) {
                Main.wm._tilePreview.hide();
            }
        } else {
            this._manager.tilePreview.hide();
        }
    }

    hitTest(pointerX, pointerY) {
        if (!this._isShowing) return null;

        for (let item of this._zoneItems) {
            let [tx, ty] = item.tileActor.get_transformed_position();
            let [tw, th] = item.tileActor.get_transformed_size();

            if (pointerX >= tx && pointerX <= tx + tw &&
                pointerY >= ty && pointerY <= ty + th) {
                return item;
            }
        }
        return null;
    }

    isPointerNearBar(pointerX, pointerY) {
        if (!this._isShowing) return false;
        let [bx, by] = this.actor.get_transformed_position();
        let [bw, bh] = this.actor.get_transformed_size();

        return (pointerX >= bx - 30 && pointerX <= bx + bw + 30 &&
                pointerY >= by - 20 && pointerY <= by + bh + 60);
    }

    destroy() {
        this.hide(true);
        if (this.actor.get_parent()) {
            Main.layoutManager.removeChrome(this.actor);
        }
        this.actor.destroy();
    }
}

class SnapManager {
    constructor(uuid) {
        this.uuid = uuid;
        this.accentColor = '#0078d4';
        this.triggerDistance = 60;
        this.windowGap = 4;
        this.playSound = true;
        this.showOnDrag = true;
        this.snapHotkey = '';

        this.layoutTwoEqual = true;
        this.layoutTwoPriority = true;
        this.layoutThreeEqual = true;
        this.layoutFourGrid = true;
        this.layoutCenterFocus = true;

        this._tickTimerId = 0;
        this._draggedWindow = null;
        this._currentMonitor = null;
        this._targetWindow = null;
        this._isDragging = false;
        this._isModalActive = false;
        this._capturedEventId = 0;
        this._keyboardSelectedPresetIndex = 0;
        this._keyboardSelectedZoneIndex = 0;

        this._initSettings();
        this.tilePreview = new TilePreview(this);
        this.snapBar = new SnapBar(this);

        this._bindSignals();
        this._setupHotkey();
    }

    _initSettings() {
        try {
            this.settings = new Settings.ExtensionSettings(this, this.uuid);
            this.settings.bindProperty(Settings.BindingDirection.IN, 'accent-color', 'accentColor', this._onSettingsChanged.bind(this), null);
            this.settings.bindProperty(Settings.BindingDirection.IN, 'trigger-distance', 'triggerDistance', this._onSettingsChanged.bind(this), null);
            this.settings.bindProperty(Settings.BindingDirection.IN, 'window-gap', 'windowGap', this._onSettingsChanged.bind(this), null);
            this.settings.bindProperty(Settings.BindingDirection.IN, 'play-sound', 'playSound', this._onSettingsChanged.bind(this), null);
            this.settings.bindProperty(Settings.BindingDirection.IN, 'show-on-drag', 'showOnDrag', this._onSettingsChanged.bind(this), null);
            this.settings.bindProperty(Settings.BindingDirection.IN, 'snap-hotkey', 'snapHotkey', this._onHotkeyChanged.bind(this), null);

            this.settings.bindProperty(Settings.BindingDirection.IN, 'layout-two-equal', 'layoutTwoEqual', this._onLayoutsChanged.bind(this), null);
            this.settings.bindProperty(Settings.BindingDirection.IN, 'layout-two-priority', 'layoutTwoPriority', this._onLayoutsChanged.bind(this), null);
            this.settings.bindProperty(Settings.BindingDirection.IN, 'layout-three-equal', 'layoutThreeEqual', this._onLayoutsChanged.bind(this), null);
            this.settings.bindProperty(Settings.BindingDirection.IN, 'layout-four-grid', 'layoutFourGrid', this._onLayoutsChanged.bind(this), null);
            this.settings.bindProperty(Settings.BindingDirection.IN, 'layout-center-focus', 'layoutCenterFocus', this._onLayoutsChanged.bind(this), null);
        } catch (e) {
            global.logWarning(`SimpleTile: Could not initialize settings: ${e.message}`);
        }
    }

    _onHotkeyChanged() {
        this._setupHotkey();
    }

    _setupHotkey() {
        try {
            Main.keybindingManager.removeHotKey('simple-tile');
            if (this.snapHotkey && typeof this.snapHotkey === 'string' && this.snapHotkey.trim() !== '') {
                Main.keybindingManager.addHotKey('simple-tile', this.snapHotkey, () => {
                    this.toggleInteractiveOverlay();
                });
            }
        } catch (e) {
            global.logWarning(`SimpleTile: Failed to update hotkey: ${e.message}`);
        }
    }

    _onSettingsChanged() {
        if (this.snapBar) {
            this.snapBar.rebuildCards();
        }
    }

    _onLayoutsChanged() {
        if (this.snapBar) {
            this.snapBar.rebuildCards();
        }
    }

    _bindSignals() {
        this._grabBeginId = global.display.connect('grab-op-begin', this._onGrabBegin.bind(this));
        this._grabEndId = global.display.connect('grab-op-end', this._onGrabEnd.bind(this));
    }

    getEnabledPresets() {
        return LAYOUT_PRESETS.filter(preset => {
            switch (preset.id) {
                case 'layout-two-equal': return this.layoutTwoEqual;
                case 'layout-two-priority': return this.layoutTwoPriority;
                case 'layout-three-equal': return this.layoutThreeEqual;
                case 'layout-four-grid': return this.layoutFourGrid;
                case 'layout-center-focus': return this.layoutCenterFocus;
                default: return true;
            }
        });
    }

    getMonitorAt(pointerX, pointerY) {
        for (let m of Main.layoutManager.monitors) {
            if (pointerX >= m.x && pointerX < m.x + m.width &&
                pointerY >= m.y && pointerY < m.y + m.height) {
                return m;
            }
        }
        return Main.layoutManager.primaryMonitor;
    }

    getWorkArea(monitor) {
        if (!monitor) monitor = Main.layoutManager.primaryMonitor;
        let ws = global.workspace_manager.get_active_workspace();
        return ws.get_work_area_for_monitor(monitor.index);
    }

    calculateZoneRect(workArea, zone) {
        let gap = Math.max(0, this.windowGap);

        let rawX = workArea.x + zone.x * workArea.width;
        let rawY = workArea.y + zone.y * workArea.height;
        let rawW = zone.w * workArea.width;
        let rawH = zone.h * workArea.height;

        if (gap === 0) {
            return {
                x: Math.round(rawX),
                y: Math.round(rawY),
                width: Math.round(rawW),
                height: Math.round(rawH),
                isMaximize: (zone.w >= 0.99 && zone.h >= 0.99)
            };
        }

        let isLeft = (zone.x === 0);
        let isRight = (Math.abs(zone.x + zone.w - 1.0) < 0.01);
        let isTop = (zone.y === 0);
        let isBottom = (Math.abs(zone.y + zone.h - 1.0) < 0.01);

        let padLeft = isLeft ? gap : gap / 2;
        let padRight = isRight ? gap : gap / 2;
        let padTop = isTop ? gap : gap / 2;
        let padBottom = isBottom ? gap : gap / 2;

        let finalX = Math.round(rawX + padLeft);
        let finalY = Math.round(rawY + padTop);
        let finalW = Math.round(rawX + rawW - padRight - finalX);
        let finalH = Math.round(rawY + rawH - padBottom - finalY);

        return {
            x: finalX,
            y: finalY,
            width: Math.max(100, finalW),
            height: Math.max(100, finalH),
            isMaximize: false
        };
    }

    _isValidTilingWindow(window) {
        if (!window) return false;
        let type = window.get_window_type();
        if (type !== Meta.WindowType.NORMAL && type !== Meta.WindowType.DIALOG) {
            return false;
        }
        if (!window.allows_move()) {
            return false;
        }
        return true;
    }

    _extractGrabArgs(args) {
        let win = null;
        let op = null;
        for (let arg of args) {
            if (arg && (arg instanceof Meta.Window || (arg.get_window_type && typeof arg.get_window_type === 'function'))) {
                win = arg;
            } else if (typeof arg === 'number') {
                op = arg;
            }
        }
        if (!win) {
            win = global.display.focus_window;
        }
        if (op === null || op === undefined) {
            op = global.display.get_grab_op();
        }
        return { win, op };
    }

    _onGrabBegin(...args) {
        if (!this.showOnDrag) return;
        let { win, op } = this._extractGrabArgs(args);

        let isMoving = (op === Meta.GrabOp.MOVING || op === Meta.GrabOp.KEYBOARD_MOVING);
        if (!isMoving) {
            let currentOp = global.display.get_grab_op();
            if (currentOp === Meta.GrabOp.MOVING || currentOp === Meta.GrabOp.KEYBOARD_MOVING) {
                isMoving = true;
                op = currentOp;
            }
        }

        if (!isMoving) {
            return;
        }

        let targetWindow = win || global.display.focus_window;
        if (!this._isValidTilingWindow(targetWindow)) {
            return;
        }

        this._draggedWindow = targetWindow;
        this._isDragging = true;

        if (this._tickTimerId) {
            GLib.source_remove(this._tickTimerId);
            this._tickTimerId = 0;
        }

        this._tickTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 16, this._onDragTick.bind(this));
    }

    _onDragTick() {
        if (!this._isDragging || !this._draggedWindow) {
            return GLib.SOURCE_REMOVE;
        }

        let [px, py] = global.get_pointer();
        let monitor = this.getMonitorAt(px, py);
        let workArea = this.getWorkArea(monitor);

        let distFromTop = py - workArea.y;

        // Check if cursor triggered the snap bar drop-down
        if (distFromTop <= this.triggerDistance && distFromTop >= -15) {
            if (!this.snapBar.isShowing() || this._currentMonitor !== monitor) {
                this._currentMonitor = monitor;
                this.snapBar.show(monitor, px);
            }
        }

        // If the snap bar is showing, handle hit-testing
        if (this.snapBar.isShowing()) {
            let isNear = this.snapBar.isPointerNearBar(px, py);
            let barHeight = this.snapBar.getActor().height;

            if (!isNear && (distFromTop > barHeight + 80 || distFromTop < -40)) {
                this.snapBar.hide();
            } else {
                let hoveredItem = this.snapBar.hitTest(px, py);
                this.snapBar.setHoveredItem(hoveredItem);
            }
        }

        return GLib.SOURCE_CONTINUE;
    }

    _onGrabEnd(...args) {
        if (!this._isDragging) return;
        this._isDragging = false;

        if (this._tickTimerId) {
            GLib.source_remove(this._tickTimerId);
            this._tickTimerId = 0;
        }

        let { win } = this._extractGrabArgs(args);
        let hoveredItem = this.snapBar.getActiveHoveredItem();
        let targetWin = this._draggedWindow || win || global.display.focus_window;
        let [px, py] = global.get_pointer();
        let targetMon = this._currentMonitor || this.getMonitorAt(px, py);

        this.snapBar.hide();
        this.tilePreview.hide();

        if (hoveredItem && targetWin) {
            this.snapWindowToZone(targetWin, hoveredItem.zone, targetMon);
        }

        this._draggedWindow = null;
        this._currentMonitor = null;
    }

    snapWindowToZone(win, zone, monitor) {
        if (!win) return;
        if (!monitor) monitor = Main.layoutManager.primaryMonitor;

        let workArea = this.getWorkArea(monitor);
        let targetRect = this.calculateZoneRect(workArea, zone);

        let applySnap = () => {
            try {
                if (!win || !win.get_compositor_private()) return;
                if (win.get_monitor() !== monitor.index) {
                    win.move_to_monitor(monitor.index);
                }
                if (win.get_maximized()) {
                    win.unmaximize(Meta.MaximizeFlags.BOTH);
                }
                if (targetRect.isMaximize) {
                    win.maximize(Meta.MaximizeFlags.BOTH);
                } else {
                    win.move_resize_frame(true, targetRect.x, targetRect.y, targetRect.width, targetRect.height);
                }
            } catch (e) {
                global.logWarning(`SimpleTile snap window error: ${e.message}`);
            }
        };

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 40, () => {
            applySnap();
            if (this.playSound && Main.soundManager) {
                Main.soundManager.play('tile');
            }
            return GLib.SOURCE_REMOVE;
        });

        // Double-application safeguard for Muffin's native drag finish
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 120, () => {
            applySnap();
            return GLib.SOURCE_REMOVE;
        });
    }

    snapCurrentWindowToZone(zone, monitor) {
        let win = global.display.focus_window;
        if (win && this._isValidTilingWindow(win)) {
            this.snapWindowToZone(win, zone, monitor);
        }
    }

    toggleInteractiveOverlay() {
        if (this._isModalActive) {
            this._closeInteractiveModal();
            return;
        }

        if (this._isDragging) {
            return;
        }

        let win = global.display.focus_window;
        if (!win || !this._isValidTilingWindow(win)) {
            return;
        }

        let monIndex = win.get_monitor();
        let monitor = Main.layoutManager.monitors[monIndex] || Main.layoutManager.primaryMonitor;
        this._currentMonitor = monitor;
        this._targetWindow = win;
        this._keyboardSelectedPresetIndex = 0;
        this._keyboardSelectedZoneIndex = 0;

        this.snapBar.show(monitor, null);
        this._openInteractiveModal();
    }

    _openInteractiveModal() {
        if (this._isModalActive) return;

        let barActor = this.snapBar.getActor();
        barActor.can_focus = true;
        barActor.reactive = true;

        if (!Main.pushModal(barActor)) {
            global.logWarning('SimpleTile: Failed to push modal');
            this.snapBar.hide(true);
            return;
        }

        this._isModalActive = true;
        barActor.grab_key_focus();

        this._highlightPresetZone(0, 0);

        this._capturedEventId = global.stage.connect('captured-event', (stage, event) => {
            return this._onModalCapturedEvent(event);
        });
    }

    _onModalCapturedEvent(event) {
        if (!this._isModalActive) return Clutter.EVENT_PROPAGATE;

        let type = event.type();

        if (type === Clutter.EventType.KEY_PRESS) {
            let symbol = event.get_key_symbol();

            if (symbol === Clutter.KEY_Escape) {
                this._closeInteractiveModal();
                return Clutter.EVENT_STOP;
            }

            let presets = this.getEnabledPresets();
            if (presets.length === 0) return Clutter.EVENT_STOP;

            let numPressed = -1;
            if (symbol >= Clutter.KEY_1 && symbol <= Clutter.KEY_9) {
                numPressed = symbol - Clutter.KEY_1;
            } else if (symbol >= Clutter.KEY_KP_1 && symbol <= Clutter.KEY_KP_9) {
                numPressed = symbol - Clutter.KEY_KP_1;
            }

            if (numPressed >= 0 && numPressed < presets.length) {
                if (this._keyboardSelectedPresetIndex === numPressed) {
                    this._keyboardSelectedZoneIndex = (this._keyboardSelectedZoneIndex + 1) % presets[numPressed].zones.length;
                } else {
                    this._keyboardSelectedPresetIndex = numPressed;
                    this._keyboardSelectedZoneIndex = 0;
                }
                this._highlightPresetZone(this._keyboardSelectedPresetIndex, this._keyboardSelectedZoneIndex);
                return Clutter.EVENT_STOP;
            }

            if (symbol === Clutter.KEY_Left) {
                this._keyboardSelectedPresetIndex = (this._keyboardSelectedPresetIndex - 1 + presets.length) % presets.length;
                this._keyboardSelectedZoneIndex = 0;
                this._highlightPresetZone(this._keyboardSelectedPresetIndex, this._keyboardSelectedZoneIndex);
                return Clutter.EVENT_STOP;
            }

            if (symbol === Clutter.KEY_Right) {
                this._keyboardSelectedPresetIndex = (this._keyboardSelectedPresetIndex + 1) % presets.length;
                this._keyboardSelectedZoneIndex = 0;
                this._highlightPresetZone(this._keyboardSelectedPresetIndex, this._keyboardSelectedZoneIndex);
                return Clutter.EVENT_STOP;
            }

            if (symbol === Clutter.KEY_Up || symbol === Clutter.KEY_Down) {
                let curPreset = presets[this._keyboardSelectedPresetIndex];
                if (curPreset && curPreset.zones.length > 1) {
                    if (symbol === Clutter.KEY_Down) {
                        this._keyboardSelectedZoneIndex = (this._keyboardSelectedZoneIndex + 1) % curPreset.zones.length;
                    } else {
                        this._keyboardSelectedZoneIndex = (this._keyboardSelectedZoneIndex - 1 + curPreset.zones.length) % curPreset.zones.length;
                    }
                    this._highlightPresetZone(this._keyboardSelectedPresetIndex, this._keyboardSelectedZoneIndex);
                }
                return Clutter.EVENT_STOP;
            }

            if (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter || symbol === Clutter.KEY_space) {
                let curPreset = presets[this._keyboardSelectedPresetIndex];
                if (curPreset && this._targetWindow) {
                    let zone = curPreset.zones[this._keyboardSelectedZoneIndex % curPreset.zones.length];
                    this.snapWindowToZone(this._targetWindow, zone, this._currentMonitor);
                }
                this._closeInteractiveModal();
                return Clutter.EVENT_STOP;
            }

            return Clutter.EVENT_PROPAGATE;
        }

        if (type === Clutter.EventType.MOTION) {
            let [px, py] = global.get_pointer();
            let item = this.snapBar.hitTest(px, py);
            if (item) {
                this._keyboardSelectedPresetIndex = item.cardIndex;
                this._keyboardSelectedZoneIndex = item.zoneIndex;
                this.snapBar.setHoveredItem(item);
            }
            return Clutter.EVENT_PROPAGATE;
        }

        if (type === Clutter.EventType.BUTTON_PRESS) {
            let [px, py] = global.get_pointer();
            let [bx, by] = this.snapBar.actor.get_transformed_position();
            let [bw, bh] = this.snapBar.actor.get_transformed_size();

            // Click outside the bar dismisses the modal
            if (px < bx || px > bx + bw || py < by || py > by + bh) {
                this._closeInteractiveModal();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        }

        if (type === Clutter.EventType.BUTTON_RELEASE) {
            let [px, py] = global.get_pointer();
            let item = this.snapBar.hitTest(px, py);
            if (item && this._targetWindow) {
                this.snapWindowToZone(this._targetWindow, item.zone, this._currentMonitor);
                this._closeInteractiveModal();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _highlightPresetZone(presetIdx, zoneIdx) {
        let presets = this.getEnabledPresets();
        if (presets.length === 0 || presetIdx >= presets.length) return;
        let targetPreset = presets[presetIdx];
        if (!targetPreset || !targetPreset.zones || targetPreset.zones.length === 0) return;
        let targetZone = targetPreset.zones[zoneIdx % targetPreset.zones.length];

        for (let item of this.snapBar._zoneItems) {
            if (item.preset === targetPreset && item.zone === targetZone) {
                this.snapBar.setHoveredItem(item);
                break;
            }
        }
    }

    _closeInteractiveModal() {
        if (!this._isModalActive) return;
        this._isModalActive = false;

        if (this._capturedEventId) {
            global.stage.disconnect(this._capturedEventId);
            this._capturedEventId = 0;
        }

        let barActor = this.snapBar ? this.snapBar.getActor() : null;
        if (barActor) {
            try {
                Main.popModal(barActor);
            } catch (e) {
                global.logWarning(`SimpleTile: popModal error: ${e.message}`);
            }
        }

        if (this.snapBar) {
            this.snapBar.hide(false);
        }
        if (this.tilePreview) {
            this.tilePreview.hide();
        }
        this._targetWindow = null;
    }

    destroy() {
        this._closeInteractiveModal();

        try {
            Main.keybindingManager.removeHotKey('simple-tile');
        } catch (e) {}

        if (this._tickTimerId) {
            GLib.source_remove(this._tickTimerId);
            this._tickTimerId = 0;
        }

        if (this._grabBeginId) {
            global.display.disconnect(this._grabBeginId);
            this._grabBeginId = 0;
        }
        if (this._grabEndId) {
            global.display.disconnect(this._grabEndId);
            this._grabEndId = 0;
        }

        if (this.snapBar) {
            this.snapBar.destroy();
            this.snapBar = null;
        }
        if (this.tilePreview) {
            this.tilePreview.destroy();
            this.tilePreview = null;
        }
    }
}

let snapManager = null;

function init(meta) {
    // Meta contains metadata.json info
}

function enable() {
    snapManager = new SnapManager('simple-tile@maciej');
    return snapManager;
}

function disable() {
    if (snapManager) {
        snapManager.destroy();
        snapManager = null;
    }
}
