# Config Reference

All runtime settings now live in `settings.json`. You should not need to edit `js/main.js` for normal tuning.

## How to use

1. Open `settings.json`.
2. Edit the path listed in the table below.
3. Save and refresh the page.

## Key paths

| Old ID | Path in `settings.json` | Current value | What it controls |
|---|---|---|---|
| `HOTSPOT_LAYOUT_PRESET` | `HOTSPOT_LAYOUT_PRESETS` | `classic`, `tower` | Hotspot geometry/material presets |
| `HOTSPOT_COLOR` | `HOTSPOT_COLORS` | `global/regional/telco/singapore` colors | Color per hotspot type |
| `CONNECTION_PAIR` | `HOTSPOT_CONNECTION_PAIRS` | 19 pairs | Manual hotspot id-to-id links |
| `HOTSPOT_DATA_SOURCE` | `HOTSPOT_DATA_SOURCES` | 4 files | Hotspot source files loaded at startup |
| `MAP_DOT_SOURCE` | `MAP_DOT_SOURCE` | `./assets/map_dots.json` | Base map point-cloud file |
| `MAP_OFFSET_X` | `CONFIG.map.offsetX` | `-0.8` | Map left/right offset |
| `MAP_OFFSET_Y` | `CONFIG.map.offsetY` | `-0.8` | Map up/down offset |
| `MAP_BACKGROUND` | `CONFIG.map.backgroundColor` | `0xf1efed` | Scene background color |
| `CAMERA_FRUSTUM` | `CONFIG.camera.frustumSize` | `15` | Orthographic camera span |
| `CAMERA_POSITION` | `CONFIG.camera.position` | `{x:-3,y:22,z:22}` | Camera location |
| `CAMERA_DEFAULT_ZOOM` | `CONFIG.camera.defaultZoom` | `1.5` | Initial zoom |
| `PERF_PIXEL_RATIO` | `CONFIG.performance.maxPixelRatio` | `1.25` | Pixel ratio clamp |
| `LIGHT_AMBIENT` | `CONFIG.lighting.ambientIntensity` | `0.32` | Ambient light level |
| `LIGHT_DIRECTIONAL` | `CONFIG.lighting.directional.intensity` | `1.5` | Main directional light level |
| `DOT_RADIUS` | `CONFIG.dots.radius` | `0.09` | Dot radius |
| `DOT_HEIGHT` | `CONFIG.dots.height` | `0.3` | Dot height |
| `DOT_COLOR` | `CONFIG.dots.color` | `0x7ae0ff` | Dot color |
| `DOT_SPACING` | `CONFIG.dots.spacing` | `1.5` | Dot spacing scale |
| `HOTSPOT_RADIUS_MULTIPLIER` | `CONFIG.hotspots.radiusMultiplier` | `1.5` | Hotspot radius multiplier |
| `HOTSPOT_HEIGHT_MULTIPLIER` | `CONFIG.hotspots.heightMultiplier` | `2.2` | Hotspot height multiplier |
| `HOTSPOT_LAYOUT` | `CONFIG.hotspots.layout.active` | `tower` | Active preset key |
| `HOTSPOT_GLOW` | `CONFIG.hotspots.effects.glow.enabled` | `true` | Hotspot halo on/off |
| `HOTSPOT_IDLE` | `CONFIG.hotspots.effects.idle.enabled` | `true` | Hotspot idle motion on/off |
| `CONNECTION_LINE` | `CONFIG.hotspots.connectionLine.enabled` | `true` | All hotspot connection lines on/off (sequential + pair lines) |
| `HOVER_RADIUS` | `CONFIG.hover.radius` | `0.35` | Hover influence radius |
| `CANVAS_LOGO` | `CONFIG.ui.canvasLogo.enabled` | `true` | Canvas logo on/off |
| `CANVAS_LOGO_ASSET` | `CONFIG.ui.canvasLogo.textureUrl` | `./assets/Dark_Font.png` | Canvas logo texture path |
| `CANVAS_LOGO_OPACITY` | `CONFIG.ui.canvasLogo.opacity` | `1` | Canvas logo opacity |
| `CANVAS_LOGO_SIZE` | `CONFIG.ui.canvasLogo.sizeByViewportHeight` | `0.07` | Canvas logo size |
| `CANVAS_LOGO_PLACEMENT_MODE` | `CONFIG.ui.canvasLogo.placementMode` | `map` | `map` or `screen` placement |
| `CANVAS_LOGO_MAP_LAT` | `CONFIG.ui.canvasLogo.mapAnchorLat` | `-36` | Map-anchored latitude |
| `CANVAS_LOGO_MAP_LON` | `CONFIG.ui.canvasLogo.mapAnchorLon` | `76` | Map-anchored longitude |
| `CANVAS_LOGO_MAP_X_OFFSET` | `CONFIG.ui.canvasLogo.mapAnchorXOffset` | `3.5` | Map-anchored x offset |
| `CANVAS_LOGO_MAP_Y_OFFSET` | `CONFIG.ui.canvasLogo.mapAnchorYOffset` | `0.02` | Map-anchored y offset |
| `CANVAS_LOGO_MARGIN_X` | `CONFIG.ui.canvasLogo.marginXByViewportWidth` | `0.02` | Screen-mode right margin |
| `CANVAS_LOGO_MARGIN_Y` | `CONFIG.ui.canvasLogo.marginYByViewportHeight` | `0.03` | Screen-mode bottom margin |
| `CANVAS_LOGO_DISTANCE` | `CONFIG.ui.canvasLogo.cameraDistance` | `1` | Screen-mode camera distance |

## Notes

- Hex colors are stored as strings like `0x23d400`.
- `js/main.js` converts these strings to numeric colors at runtime.
- `CONFIG.hotspots.layout.presets` and `CONFIG.hotspots.connectionPairs` are automatically linked from `HOTSPOT_LAYOUT_PRESETS` and `HOTSPOT_CONNECTION_PAIRS`.

