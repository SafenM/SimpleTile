#!/usr/bin/env bash
#
# Simple Tile - Window Tiling for Cinnamon
# Installer & Management Script
#

set -e

UUID="simple-tile@maciej"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_DIR="${HOME}/.local/share/cinnamon/extensions/${UUID}"

echo "=========================================="
echo "  Simple Tile: Cinnamon Window Tiling"
echo "  Cinnamon Desktop Extension Installer"
echo "=========================================="

usage() {
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  --install, -i     Install extension as a symlink for development (default)"
    echo "  --copy            Install by copying files instead of symlinking"
    echo "  --reload, -r      Reload extension in current Cinnamon session"
    echo "  --enable          Enable extension in Cinnamon settings"
    echo "  --disable         Disable extension in Cinnamon settings"
    echo "  --uninstall, -u   Remove extension and uninstall from Cinnamon"
    echo "  --help, -h        Show this help message"
    echo ""
    exit 0
}

cleanup_legacy() {
    # Migrate old cinnwin@snaplayouts if present
    OLD_UUID="cinnwin@snaplayouts"
    OLD_DIR="${HOME}/.local/share/cinnamon/extensions/${OLD_UUID}"
    OLD_CONFIG_DIR="${HOME}/.config/cinnamon/spices/${OLD_UUID}"
    NEW_CONFIG_DIR="${HOME}/.config/cinnamon/spices/${UUID}"

    if [ -e "${OLD_DIR}" ]; then
        echo "-> Cleaning up legacy ${OLD_UUID}..."
        rm -rf "${OLD_DIR}"
    fi

    # Migrate config if exists
    if [ -f "${OLD_CONFIG_DIR}/${OLD_UUID}.json" ] && [ ! -f "${NEW_CONFIG_DIR}/${UUID}.json" ]; then
        echo "-> Preserving existing user preferences..."
        mkdir -p "${NEW_CONFIG_DIR}"
        cp "${OLD_CONFIG_DIR}/${OLD_UUID}.json" "${NEW_CONFIG_DIR}/${UUID}.json"
    fi

    CURRENT=$(gsettings get org.cinnamon enabled-extensions 2>/dev/null || echo "[]")
    if [[ "$CURRENT" == *"'${OLD_UUID}'"* || "$CURRENT" == *"\"${OLD_UUID}\""* ]]; then
        NEW_LIST=$(python3 -c "
import ast, re
raw = re.sub(r'^@[a-z]+\s*', '', '''${CURRENT}'''.strip())
try:
    current = ast.literal_eval(raw)
except Exception:
    current = []
if '${OLD_UUID}' in current:
    current.remove('${OLD_UUID}')
print(str(current))
")
        gsettings set org.cinnamon enabled-extensions "${NEW_LIST}"
        python3 -c "
import dbus
try:
    bus = dbus.SessionBus()
    cinnamon = bus.get_object('org.Cinnamon', '/org/Cinnamon')
    cinnamon.Eval('imports.ui.extension.unloadExtension(\"${OLD_UUID}\", imports.ui.extension.Type.EXTENSION);', dbus_interface='org.Cinnamon')
except:
    pass
" 2>/dev/null || true
    fi
}

reload_extension() {
    echo "-> Reloading ${UUID} in Cinnamon..."
    python3 -c "
import dbus
try:
    bus = dbus.SessionBus()
    cinnamon = bus.get_object('org.Cinnamon', '/org/Cinnamon')
    script = '''
    const Extension = imports.ui.extension;
    Extension.unloadExtension('${UUID}', Extension.Type.EXTENSION);
    Extension.loadExtension('${UUID}', Extension.Type.EXTENSION);
    '''
    cinnamon.Eval(script, dbus_interface='org.Cinnamon')
    print('   Successfully reloaded in running Cinnamon session!')
except Exception as e:
    print('   Note: Could not reload dynamically via D-Bus (' + str(e) + '). Restarting Cinnamon or logging out will activate it.')
"
}

enable_extension() {
    echo "-> Enabling ${UUID} in gsettings..."
    CURRENT=$(gsettings get org.cinnamon enabled-extensions)
    if [[ "$CURRENT" != *"'${UUID}'"* && "$CURRENT" != *"\"${UUID}\""* ]]; then
        NEW_LIST=$(python3 -c "
import ast, re
raw = re.sub(r'^@[a-z]+\s*', '', '''${CURRENT}'''.strip())
try:
    current = ast.literal_eval(raw)
except Exception:
    current = []
if '${UUID}' not in current:
    current.append('${UUID}')
print(str(current))
")
        gsettings set org.cinnamon enabled-extensions "${NEW_LIST}"
        echo "   Added to enabled-extensions: ${NEW_LIST}"
    else
        echo "   Extension is already enabled in gsettings."
    fi
}

disable_extension() {
    echo "-> Disabling ${UUID} in gsettings..."
    CURRENT=$(gsettings get org.cinnamon enabled-extensions)
    if [[ "$CURRENT" == *"'${UUID}'"* || "$CURRENT" == *"\"${UUID}\""* ]]; then
        NEW_LIST=$(python3 -c "
import ast, re
raw = re.sub(r'^@[a-z]+\s*', '', '''${CURRENT}'''.strip())
try:
    current = ast.literal_eval(raw)
except Exception:
    current = []
if '${UUID}' in current:
    current.remove('${UUID}')
print(str(current))
")
        gsettings set org.cinnamon enabled-extensions "${NEW_LIST}"
        echo "   Removed from enabled-extensions."
    fi
    python3 -c "
import dbus
try:
    bus = dbus.SessionBus()
    cinnamon = bus.get_object('org.Cinnamon', '/org/Cinnamon')
    cinnamon.Eval('imports.ui.extension.unloadExtension(\"${UUID}\", imports.ui.extension.Type.EXTENSION);', dbus_interface='org.Cinnamon')
except:
    pass
"
}

install_symlink() {
    cleanup_legacy
    echo "-> Installing development symlink..."
    mkdir -p "${HOME}/.local/share/cinnamon/extensions"
    ln -sfn "${SCRIPT_DIR}" "${EXT_DIR}"
    echo "   Symlinked: ${EXT_DIR} -> ${SCRIPT_DIR}"
    enable_extension
    reload_extension
    echo "-> Done! Drag a window to the top of your screen to test."
}

install_copy() {
    cleanup_legacy
    echo "-> Installing by copying files..."
    mkdir -p "${EXT_DIR}"
    rm -rf "${EXT_DIR}"/*
    cp -r "${SCRIPT_DIR}"/* "${EXT_DIR}/"
    echo "   Copied files to ${EXT_DIR}"
    enable_extension
    reload_extension
    echo "-> Done! Drag a window to the top of your screen to test."
}

uninstall() {
    echo "-> Uninstalling ${UUID}..."
    disable_extension
    if [ -L "${EXT_DIR}" ] || [ -d "${EXT_DIR}" ]; then
        rm -rf "${EXT_DIR}"
        echo "   Removed ${EXT_DIR}"
    fi
    echo "-> Successfully uninstalled."
}

# Parse command line argument
ACTION="${1:---install}"

case "$ACTION" in
    --install|-i)
        install_symlink
        ;;
    --copy)
        install_copy
        ;;
    --reload|-r)
        reload_extension
        ;;
    --enable)
        enable_extension
        ;;
    --disable)
        disable_extension
        ;;
    --uninstall|-u)
        uninstall
        ;;
    --help|-h)
        usage
        ;;
    *)
        echo "Unknown option: $ACTION"
        usage
        ;;
esac
