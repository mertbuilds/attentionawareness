import os

app = os.environ["DMG_APP_PATH"]
appname = os.path.basename(app)

files = [app]
symlinks = {"Applications": "/Applications"}

# App icon on the left, Applications on the right, both centered vertically in
# the 400px window so the background art's headline sits above them. The DMG's
# own bookkeeping files are pushed far off canvas so users with "show hidden
# files" enabled never see them in the install window.
icon_locations = {
    appname: (175, 270),
    "Applications": (425, 270),
    ".background.tiff": (5000, 5000),
    ".DS_Store": (5000, 5000),
    ".fseventsd": (5000, 5000),
    ".Trashes": (5000, 5000),
    ".VolumeIcon.icns": (5000, 5000),
}

format = "UDZO"
filesystem = "HFS+"
size = None

window_rect = ((200, 120), (600, 400))
icon_size = 100
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
