// CamiTube — display settings
// To change WHICH channels appear, edit channels.json instead (that list
// feeds the GitHub Action that builds videos.json).

const PAGE_SIZE = 24;          // how many videos reveal per "Show older videos" click
const LATEST_WINDOW_DAYS = 7;  // how far back "Latest videos" looks

// Short names shown on the filter pills and video cards, keyed by handle
// (must match the handles in channels.json, including the @).
const DISPLAY_NAMES = {
  "@Figma": "Figma",
  "@UICollectiveDesign": "UI Collective",
  "@Raul-Marin-Calleja": "Raúl Marín",
  "@NehmatGereige": "Nehmat Gereige",
  "@martacondedesign": "Marta Conde",
  "@thedesignproject": "TDP",
  "@IntoDesignSystems": "IntoDS",
  "@MalewiczHype": "Malewicz",
};
