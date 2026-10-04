import os

app = os.environ["DMG_APP_PATH"]
appname = os.path.basename(app)

files = [app]
symlinks = {"Applications": "/Applications"}

# App icon on the left, Applications on the right, both centered vertically in
# the 460px window so the background art's headline sits above them. The DMG's
# own bookkeeping files are pushed far off canvas so users with "show hidden
# files" enabled never see them in the install window.
#
# The art draws a gray tile behind each icon and the arrow between them, so the
# two positions and icon_size below are repeated at the top of
# dmg-background.html (--app-x, --applications-x, --icon-y, --icon). Change
# them in both places, then run scripts/render-dmg-background.sh.
icon_locations = {
    appname: (210, 320),
    "Applications": (470, 320),
    ".background.tiff": (5000, 5000),
    ".DS_Store": (5000, 5000),
    ".fseventsd": (5000, 5000),
    ".Trashes": (5000, 5000),
    ".VolumeIcon.icns": (5000, 5000),
}

format = "UDZO"
filesystem = "HFS+"
size = None

# WindowBounds counts the window chrome inside the height, and the background is
# drawn in the content area below it. On current macOS the install window keeps
# its title bar, toolbar and status bar (about 92pt total) even with the flags
# below, so the window is sized content + 92. The art is 680x540, taller than any
# content region, so it fills to the edges with no gap whichever chrome shows.
window_rect = ((180, 100), (680, 552))
icon_size = 120
# Finder draws the labels itself: black in light appearance, white in dark, and
# nothing here can set the colour or hide them. The art is black, so the gray
# tiles are what keep a black label readable.
text_size = 12

# dmgbuild picks up dmg-background@2x.png automatically when it sits beside this.
background = os.environ.get("DMG_BACKGROUND", "scripts/dmg-background.png")
show_status_bar = False
show_tab_view = False
show_toolbar = False
show_pathbar = False
show_sidebar = False
sidebar_width = 180
show_icon_preview = False
include_icon_view_settings = "auto"
include_list_view_settings = "auto"
arrange_by = None
grid_offset = (0, 0)
grid_spacing = 100
scroll_position = (0, 0)
label_pos = "bottom"
default_view = "icon-view"
