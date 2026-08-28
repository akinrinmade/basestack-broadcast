import { AlertOctagon, AlertTriangle, ChevronLeft, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ParameterContext, StagedEntry } from "@/lib/readings/types";

export interface ReviewRow {
  parameter: ParameterContext;
  entry: StagedEntry;
}

interface ReviewRoundScreenProps {
  equipmentLabel: string;
  rows: ReviewRow[];
  sending: boolean;
  onEdit: (parameterId: string) => void;
  onBack: () => void;
  onConfirmSend: () => void;
  /** Machines with unconfirmed first-touch parameters — shown as an
   * explicit "these will be skipped" notice so the operator can send a
   * round that legitimately doesn't cover every machine (some are off or
   * out of service) without the app silently pretending nothing's missing. */
  pendingByMachine?: { key: string; count: number }[];
  onGoToMachine?: (machineKey: string) => void;
}

/**
 * UX review: "Add a review screen ... so users can verify all entered
 * readings before submitting." Shown after every parameter in the current
 * equipment is confirmed and before the sign-off/PIN step, so an operator
 * gets one last look — and a direct way back into any single reading —
 * before the round-level Send actually fires.
 */
// Same banding rule use-readings-round.ts uses for the Detailed Flow queue
// and the "Not read this round" list — kept in sync so a machine's rows
// here group under the same key it's referred to by everywhere else.
function machineBandKey(parameter: ParameterContext): string {
  return parameter.equipment_tag_id || parameter.equipment_name || parameter.group_name || "";
}

function machineBandLabel(parameter: ParameterContext): string {
  return parameter.equipment_name || parameter.equipment_tag_id || parameter.group_name || "Other";
}

export function ReviewRoundScreen({
  equipmentLabel,
  rows,
  sending,
  onEdit,
  onBack,
  onConfirmSend,
  pendingByMachine = [],
  onGoToMachine,
}: ReviewRoundScreenProps) {
  const hasPending = pendingByMachine.length > 0;

  // Group into per-machine bands so "Compressor Outlet Pressure" ×4 reads as
  // four *different* machines instead of a flat, unlabelled repeat — the
  // exact confusion flagged: "I don't even know which is which compressor."
  // Rows already arrive sorted by machine (see currentEquipmentRows), so a
  // single pass is enough to band them without re-sorting here.
  const groups: { key: string; label: string; rows: ReviewRow[] }[] = [];
  for (const row of rows) {
    const key = machineBandKey(row.parameter);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.rows.push(row);
    } else {
      groups.push({ key, label: machineBandLabel(row.parameter), rows: [row] });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-border px-2 pt-safe">
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-11 min-w-11 items-center gap-0.5 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent"
        >
          <ChevronLeft className="h-5 w-5" /> Back
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold">
          Review — {equipmentLabel}
        </h1>
        <span className="min-w-11" />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <p className="mb-3 text-sm text-muted-foreground">
          Check these {rows.length} reading{rows.length === 1 ? "" : "s"} before sending. Tap any
          row to go back and edit it.
        </p>

        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.key}>
              <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {group.rows.map(({ parameter, entry }) => {
                  const value =
                    entry.modeValue ??
                    (entry.valueNumeric != null
                      ? `${entry.valueNumeric}${parameter.unit ? ` ${parameter.unit}` : ""}`
                      : (entry.valueCategorical ?? "—"));
                  return (
                    <li key={parameter.id}>
                      <button
                        type="button"
                        onClick={() => onEdit(parameter.id)}
                        className="flex min-h-11 w-full items-start justify-between gap-3 px-3 py-2.5 text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-medium">{parameter.name}</p>
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <span
                              className={cn(
                                "font-medium tabular-nums",
                                entry.previewCritical
                                  ? "text-destructive"
                                  : entry.previewOutOfRange
                                    ? "text-warning-foreground"
                                    : "text-foreground",
                              )}
                            >
                              {value}
                            </span>
                            {entry.previewCritical && (
                              <span className="flex items-center gap-0.5 text-destructive">
                                <AlertOctagon className="h-3 w-3" /> Critical
                              </span>
                            )}
                            {!entry.previewCritical && entry.previewOutOfRange && (
                              <span className="flex items-center gap-0.5 text-warning-foreground">
                                <AlertTriangle className="h-3 w-3" /> Out of range
                              </span>
                            )}
                          </p>
                        </div>
                        <Pencil className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {rows.length === 0 && (
          <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            Nothing entered for this equipment yet.
          </div>
        )}

        {hasPending && (
          <div className="mt-4 rounded-lg border border-warning/40 bg-warning/10 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-warning-foreground">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Not read this round
            </p>
            <p className="mb-2 text-xs text-muted-foreground">
              These machines have no entries yet. Sending now will skip them — use this only if
              they're genuinely off or out of service. Tap one to go enter it instead.
            </p>
            <ul className="space-y-1">
              {pendingByMachine.map((m) => (
                <li key={m.key}>
                  <button
                    type="button"
                    onClick={() => onGoToMachine?.(m.key)}
                    className="flex min-h-9 w-full items-center justify-between rounded-md px-2 text-sm hover:bg-warning/10"
                  >
                    <span className="font-medium">{m.key}</span>
                    <span className="text-xs text-muted-foreground">{m.count} pending</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border p-4 pb-safe">
        <Button
          type="button"
          size="lg"
          variant={hasPending ? "outline" : "default"}
          className="min-h-11 w-full"
          disabled={sending || rows.length === 0}
          onClick={onConfirmSend}
        >
          {sending ? "Sending…" : hasPending ? "Send anyway, skip the rest" : "Confirm & send"}
        </Button>
      </div>
    </div>
  );
}
