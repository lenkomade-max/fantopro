/**
 * Position Utility for Remotion Video Components
 *
 * Converts flexible position formats (percentages, aliases, pixels) to absolute pixel values.
 * Supports portrait (1080×1920) and landscape (1920×1080) orientations.
 *
 * @example
 * // Using percentages
 * resolvePosition({ x: "50%", y: "30%" }, 1080, 1920)
 * // → { x: 540, y: 576 }
 *
 * @example
 * // Using aliases
 * resolvePosition({ x: "center", y: "top" }, 1080, 1920)
 * // → { x: 540, y: 0 }
 *
 * @example
 * // Using pixels
 * resolvePosition({ x: 100, y: 200 }, 1080, 1920)
 * // → { x: 100, y: 200 }
 *
 * @example
 * // Mixing formats
 * resolvePosition({ x: "center", y: 200 }, 1080, 1920)
 * // → { x: 540, y: 200 }
 */

/**
 * Position value types:
 * - number: Absolute pixels
 * - string percentage: "50%" = 50% of dimension
 * - string alias: "left", "center", "right", "top", "bottom"
 */
export type PositionValue = number | string;

/**
 * Position object with x and y coordinates
 */
export interface Position {
  x: PositionValue;
  y: PositionValue;
}

/**
 * Resolved position with absolute pixel values
 */
export interface ResolvedPosition {
  x: number;
  y: number;
}

/**
 * Horizontal alignment aliases
 */
const HORIZONTAL_ALIASES: Record<string, number> = {
  left: 0,
  center: 50,
  right: 100,
};

/**
 * Vertical alignment aliases
 */
const VERTICAL_ALIASES: Record<string, number> = {
  top: 0,
  center: 50,
  bottom: 100,
};

/**
 * Parse a position value to percentage
 *
 * @param value - Position value (number, percentage string, or alias)
 * @param aliases - Alias mapping for this dimension
 * @returns Percentage value (0-100)
 */
function parsePositionValue(
  value: PositionValue,
  aliases: Record<string, number>
): number {
  // Already a number in pixels
  if (typeof value === "number") {
    return -1; // Signal that this is absolute pixels
  }

  // String value
  const strValue = value.trim().toLowerCase();

  // Check if it's a percentage
  if (strValue.endsWith("%")) {
    const percent = parseFloat(strValue);
    if (isNaN(percent)) {
      throw new Error(`Invalid percentage value: ${value}`);
    }
    return Math.max(0, Math.min(100, percent));
  }

  // Check if it's an alias
  if (strValue in aliases) {
    return aliases[strValue];
  }

  throw new Error(
    `Invalid position value: ${value}. Expected number, percentage, or one of: ${Object.keys(aliases).join(", ")}`
  );
}

/**
 * Resolve a position to absolute pixel coordinates
 *
 * @param position - Position with flexible format
 * @param width - Video width in pixels
 * @param height - Video height in pixels
 * @returns Resolved position with absolute pixel values
 *
 * @example
 * resolvePosition({ x: "50%", y: "30%" }, 1080, 1920)
 * // Returns: { x: 540, y: 576 }
 *
 * @example
 * resolvePosition({ x: "center", y: "top" }, 1080, 1920)
 * // Returns: { x: 540, y: 0 }
 *
 * @example
 * resolvePosition({ x: 100, y: "50%" }, 1080, 1920)
 * // Returns: { x: 100, y: 960 }
 */
export function resolvePosition(
  position: Position,
  width: number,
  height: number
): ResolvedPosition {
  const xPercent = parsePositionValue(position.x, HORIZONTAL_ALIASES);
  const yPercent = parsePositionValue(position.y, VERTICAL_ALIASES);

  const x = xPercent === -1
    ? (position.x as number)
    : Math.round((width * xPercent) / 100);

  const y = yPercent === -1
    ? (position.y as number)
    : Math.round((height * yPercent) / 100);

  return { x, y };
}

/**
 * Resolve a single position value (for captions, etc.)
 *
 * @param value - Position value (number, percentage, or alias)
 * @param dimension - Dimension size in pixels
 * @param isVertical - Whether this is a vertical position (uses vertical aliases)
 * @returns Resolved pixel value
 *
 * @example
 * resolvePositionValue("50%", 1920, true)
 * // Returns: 960
 *
 * @example
 * resolvePositionValue("center", 1080, false)
 * // Returns: 540
 *
 * @example
 * resolvePositionValue(100, 1920, true)
 * // Returns: 100
 */
export function resolvePositionValue(
  value: PositionValue,
  dimension: number,
  isVertical: boolean = true
): number {
  const aliases = isVertical ? VERTICAL_ALIASES : HORIZONTAL_ALIASES;
  const percent = parsePositionValue(value, aliases);

  if (percent === -1) {
    return value as number;
  }

  return Math.round((dimension * percent) / 100);
}

/**
 * Get video dimensions based on orientation
 *
 * @param orientation - Video orientation ("portrait" or "landscape")
 * @returns Object with width and height
 */
export function getVideoDimensions(orientation: "portrait" | "landscape"): {
  width: number;
  height: number;
} {
  if (orientation === "portrait") {
    return { width: 1080, height: 1920 };
  }
  return { width: 1920, height: 1080 };
}
