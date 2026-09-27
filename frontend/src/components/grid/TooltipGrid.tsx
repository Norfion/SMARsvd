import type { CustomTooltipProps } from "ag-grid-react";

export function TooltipGrid({ value }: CustomTooltipProps) {
  return (
    <div className="tooltip-grid" role="tooltip">
      {String(value)}
    </div>
  );
}
