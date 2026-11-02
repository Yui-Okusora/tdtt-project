/** Semantic design tokens shared by UI components, independent of color palettes. */
export const DESIGN_TOKENS = Object.freeze({
  typography: Object.freeze({
    body: "Be Vietnam Pro",
    display: "Bricolage Grotesque",
  }),
  iconSize: 22,
  iconStroke: 2,
  spacing: Object.freeze([8, 12, 16, 24, 32, 48]),
  radii: Object.freeze({ small: 10, medium: 16, large: 24, extraLarge: 32 }),
  interaction: Object.freeze({ tapTarget: 44, motionMs: 180 }),
});
export const CAMERA_TIMERS = Object.freeze([0, 3, 5, 10]);
