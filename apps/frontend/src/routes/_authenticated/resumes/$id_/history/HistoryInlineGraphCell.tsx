/**
 * HistoryInlineGraphCell — inline SVG for one commit row in the History table.
 *
 * Renders:
 *   • Vertical lane lines for all branches active at this row
 *   • L-shaped outgoing curves: horizontal stub from this commit, rounded
 *     corner, then vertical up-and-out the top of the row (continues on
 *     child's lane via lane-line rendering in the rows above).
 *   • Commit node: filled circle (save) or outlined circle (merge)
 *   • Faint ring when the row is selected/active
 */

import { memo } from "react";
import {
  CURVE_CORNER,
  LANE_COLORS,
  LANE_GAP,
  LANE_LEFT,
  ROW_H,
  ROW_MID,
  laneColor,
} from "./history-inline-graph";
import type { InlineGraphData, InlineGraphRow, LaneRange } from "./history-inline-graph";

interface Props {
  row: InlineGraphRow;
  graphData: InlineGraphData;
  active: boolean;
}

const NODE_R_SAVE = 4.5;
const NODE_R_MERGE = 5.5;
const NODE_R_RING = 9;
const STROKE_W = 1.8;

export const HistoryInlineGraphCell = memo(function HistoryInlineGraphCell({
  row,
  graphData,
  active,
}: Props) {
  const { laneSegments, laneCount, svgWidth } = graphData;
  const { rowIndex, laneIndex, isMerge, outgoingCurves } = row;

  const nodeX = LANE_LEFT + laneIndex * LANE_GAP;
  const nodeColor = laneColor(laneIndex);

  return (
    <svg
      width={svgWidth}
      height={ROW_H}
      viewBox={`0 0 ${svgWidth} ${ROW_H}`}
      style={{ display: "block", overflow: "visible" }}
    >
      {/* Lane lines — each lane may have multiple segments (column reuse for
          non-overlapping branches), so we check every segment independently. */}
      {Array.from({ length: laneCount }, (_, l) => {
        const segments = laneSegments[l] ?? [];
        const x = LANE_LEFT + l * LANE_GAP;
        const color = LANE_COLORS[l % LANE_COLORS.length];
        // Suppress the top-half stub in a fork/merge row where this commit's
        // outgoing curve already covers the connection for that lane.
        const isCurveTarget = outgoingCurves.some((c) => c.targetLaneIndex === l);

        const pieces = segments
          .map((seg: LaneRange, si: number) => {
            if (rowIndex < seg.minRowIndex || rowIndex > seg.maxRowIndex) return null;
            const drawTop = rowIndex > seg.minRowIndex && !isCurveTarget;
            const drawBottom = rowIndex < seg.maxRowIndex;
            return (
              <g key={si}>
                {drawTop && (
                  <line x1={x} y1={0} x2={x} y2={ROW_MID} stroke={color} strokeWidth={STROKE_W} />
                )}
                {drawBottom && (
                  <line x1={x} y1={ROW_MID} x2={x} y2={ROW_H} stroke={color} strokeWidth={STROKE_W} />
                )}
              </g>
            );
          })
          .filter(Boolean);

        return pieces.length > 0 ? <g key={l}>{pieces}</g> : null;
      })}

      {/* L-shaped outgoing curves — horizontal stub from the parent commit,
          rounded corner, then vertical up to the top of the row.  The target
          lane's vertical line in the rows above continues the connection
          until it reaches the child commit. */}
      {outgoingCurves.map((curve, k) => {
        const xp = nodeX;
        const xc = LANE_LEFT + curve.targetLaneIndex * LANE_GAP;
        const direction = xc > xp ? 1 : -1;
        const cornerStartX = xc - direction * CURVE_CORNER;
        return (
          <path
            key={k}
            d={`M ${xp} ${ROW_MID} L ${cornerStartX} ${ROW_MID} Q ${xc} ${ROW_MID} ${xc} ${ROW_MID - CURVE_CORNER} L ${xc} 0`}
            stroke={laneColor(curve.targetLaneIndex)}
            strokeWidth={STROKE_W}
            fill="none"
          />
        );
      })}

      {/* Commit node */}
      {isMerge ? (
        <circle
          cx={nodeX}
          cy={ROW_MID}
          r={NODE_R_MERGE}
          fill="oklch(13% 0.008 250)"
          stroke={nodeColor}
          strokeWidth={STROKE_W}
        />
      ) : (
        <circle
          cx={nodeX}
          cy={ROW_MID}
          r={NODE_R_SAVE}
          fill={nodeColor}
          stroke={nodeColor}
          strokeWidth={STROKE_W}
        />
      )}

      {/* Active ring */}
      {active && (
        <circle
          cx={nodeX}
          cy={ROW_MID}
          r={NODE_R_RING}
          fill="none"
          stroke={nodeColor}
          strokeWidth={1.2}
          opacity={0.45}
        />
      )}
    </svg>
  );
});
