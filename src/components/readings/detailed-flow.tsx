import { useRef, useState } from "react";
import { AlertOctagon, ArrowDown, ArrowUp, ArrowRight, ChevronLeft, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { previewFlags, formatAcceptableRange } from "@/lib/readings/thresholds";
import { useParameterHistory } from "@/lib/readings/queries";
import { ReadingHistoryPanel } from "@/components/readings/reading-history-panel";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import type { ParameterContext, StagedEntry } from "@/lib/readings/types";

export interface DetailedFlowQueueItem {
  parameterId: string;
  /** first-touch/flagged/manual keep their existing meaning and banners.
   * "routine" is a normal, already-established reading now also routed
   * through this one-at-a-time flow (operator preference: the grid/table
   * view was hard to read at a glance) — tracked the same as first-touch
   * for pending/skip purposes, but shows no reason banner. */
  reason: "first-touch" | "flagged" | "manual" | "routine";
}

interface DetailedFlowProps {
  parameter: ParameterContext;
  indexInQueue: number;
  queueLength: number;
  reason: DetailedFlowQueueItem["reason"];
  staged: StagedEntry | undefined;
  deviceContext: "mobile" | "shared";
  operatorName: string;
  onStage: (
    entry: Pick<
      StagedEntry,
      "valueNumeric" | "valueCategorical" | "modeValue" | "previewOutOfRange" | "previewCritical"
    >,
  ) => void;
  /** Marks the current parameter confirmed (if it has a value) and advances — or closes back to the grid if this was the last item in the queue. */
  onConfirmAndNext: () => void;
  /** Advances to the next queue item without confirming the current one — lets an operator come back to it later. */
  onSkip: () => void;
  /** Moves back to the previous queue item, preserving whatever has been entered on this one. */
  onPrevious: () => void;
  /** Leaves the detailed flow entirely, back to the equipment-scoped grid. */
  onExit: () => void;
}

/**
 * screens-flows.md, Detailed flow — full single-parameter screen used for
 * first-touch parameters, anything queued from Quick Round review, or a
 * manually expanded row. Confirm here is a LOCAL confirm only (rule 36):
 * it stages the value into the round, it never sends to the server and
 * never triggers its own PIN prompt. Only the round-level Send does that.
 *
 * UX review pass: operators can move freely back and forth through the
 * queue (Back/Skip/Next), values already typed are preserved either way
 * because they live in `staged` the moment they're entered; the input is
 * the visual focus of the screen; and progress is shown as a plain bar
 * instead of "item 12 of 47" style counters.
 */
export function DetailedFlow({
  parameter,
  indexInQueue,
  queueLength,
  reason,
  staged,
  deviceContext,
  operatorName,
  onStage,
  onConfirmAndNext,
  onSkip,
  onPrevious,
  onExit,
}: DetailedFlowProps) {
  const { data: history } = useParameterHistory(parameter.id);
  const [draftNumeric, setDraftNumeric] = useState<string>(staged?.valueNumeric?.toString() ?? "");
  const [draftCategorical, setDraftCategorical] = useState<string | null>(
    staged?.valueCategorical ?? null,
  );
  const [draftMode, setDraftMode] = useState<string | null>(staged?.modeValue ?? null);
  const [technicianAcknowledged, setTechnicianAcknowledged] = useState(deviceContext === "mobile");
  const [showMoreContext, setShowMoreContext] = useState(false);

  // UX feedback, Aug 2026: "have to minimize my keyboard to see confirm
  // and next" / bottom buttons "disappear immediately I switch to my
  // keyboard". Size this panel to the space actually visible above the
  // on-screen keyboard instead of the full (keyboard-obscured) viewport.
  const { viewportHeight, offsetTop } = useKeyboardInset();

  // UX feedback, Aug 2026: "log in to back button ... add a pop up
  // confirmation window to exit, so as not to exit any how the app or
  // reading taking". The hardware/gesture back gesture is trapped and
  // confirmed centrally by useReadingsRound (see its `closeDetailedFlow` /
  // `pendingDetailedExitConfirm` — keyed off `staged`, which the round
  // hook already owns) instead of here. This screen used to run its own
  // second, independent history push/listen pair for the same purpose;
  // that duplicate trap could fire at the same time as the round hook's
  // and race with it, and it never got cleaned up on a plain on-screen
  // exit — both contributed to the back button occasionally blowing past
  // the app entirely. The Back/X buttons below now just call `onExit`,
  // same as a gesture back does, so both paths share one decision.
  const requestExit = onExit;

  // Rapid-tap guard (UX feedback, Aug 2026: "A prompt when rapid tapping is
  // initiated"). Confirm & Next unmounts/remounts this whole screen for the
  // next queue item, so a double-tap or over-eager second tap before the
  // remount lands can silently fire twice on two different parameters. This
  // doesn't disable the button (that reads as unresponsive on a slow
  // device) — it just ignores a second fire within the window and tells the
  // operator why, instead of silently swallowing it.
  const lastConfirmAtRef = useRef(0);
  function handleConfirmAndNext() {
    const now = Date.now();
    if (now - lastConfirmAtRef.current < 600) {
      toast("Just a moment — that reading's already being saved.");
      return;
    }
    lastConfirmAtRef.current = now;
    onConfirmAndNext();
  }

  const isFirst = indexInQueue === 0;
  const isLast = indexInQueue >= queueLength - 1;
  const reasonLabel =
    reason === "flagged" ? "Flagged for review" : reason === "first-touch" ? "New parameter" : null;

  function stageNumeric(raw: string) {
    setDraftNumeric(raw);
    const num = Number(raw);
    if (raw.trim() === "" || Number.isNaN(num)) return;
    const flags = previewFlags(parameter, { numeric: num });
    onStage({
      valueNumeric: num,
      valueCategorical: null,
      modeValue: null,
      previewOutOfRange: flags.outOfRange,
      previewCritical: flags.critical,
    });
  }

  function stageCategorical(option: string) {
    setDraftCategorical(option);
    const flags = previewFlags(parameter, { categorical: option });
    onStage({
      valueNumeric: null,
      valueCategorical: option,
      modeValue: null,
      previewOutOfRange: flags.outOfRange,
      previewCritical: flags.critical,
    });
  }

  function stageMode(option: string) {
    setDraftMode(option);
    // Mode changes aren't flagged the way numeric/categorical readings are.
    onStage({
      valueNumeric: null,
      valueCategorical: null,
      modeValue: option,
      previewOutOfRange: false,
      previewCritical: false,
    });
  }

  const hasValue = parameter.track_mode_changes
    ? draftMode != null
    : parameter.field_type === "numeric"
      ? draftNumeric.trim() !== "" && !Number.isNaN(Number(draftNumeric))
      : draftCategorical != null;

  const min = parameter.min_valid;
  const max = parameter.max_valid;
  const gaugePercent =
    min != null && max != null && draftNumeric !== "" && !Number.isNaN(Number(draftNumeric))
      ? Math.max(0, Math.min(100, ((Number(draftNumeric) - min) / (max - min)) * 100))
      : null;

  const trend = (() => {
    if (!history || history.length < 2) return null;
    const last = history[history.length - 1]?.value_numeric;
    const prev = history[history.length - 2]?.value_numeric;
    if (last == null || prev == null) return null;
    if (last > prev) return "up";
    if (last < prev) return "down";
    return "flat";
  })();

  const isCritical = staged?.previewCritical;
  const acceptableRange = formatAcceptableRange(parameter);
  const canConfirm = hasValue && technicianAcknowledged;

  return (
    <div
      className="fixed inset-x-0 z-50 flex flex-col bg-background"
      style={{ top: offsetTop, height: viewportHeight }}
    >
      <header className="flex min-h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-2 pt-safe">
        <button
          type="button"
          onClick={isFirst ? requestExit : onPrevious}
          className="flex min-h-11 min-w-11 shrink-0 items-center gap-0.5 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent"
        >
          <ChevronLeft className="h-5 w-5" />
          {isFirst ? "Equipment" : "Back"}
        </button>

        {/* Plain progress bar — deliberately no "item X of Y" count, which
            can feel overwhelming across a long round (UX review). */}
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
          {reasonLabel && (
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {reasonLabel}
            </span>
          )}
          <div className="flex w-full max-w-40 gap-1">
            {Array.from({ length: Math.min(queueLength, 8) }).map((_, i) => {
              // For longer queues, collapse into evenly-spaced segments
              // rather than one dot per item so the bar never looks noisy.
              const segmentIndex = queueLength <= 8 ? i : Math.floor((i / 8) * queueLength);
              const filled = segmentIndex <= indexInQueue;
              return (
                <div
                  key={i}
                  className={cn("h-1.5 flex-1 rounded-full", filled ? "bg-primary" : "bg-muted")}
                />
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={requestExit}
          aria-label="Exit to equipment list"
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
        {/* Sticky so it stays pinned to the top of this scroll area even
            when the keyboard opens and the browser auto-scrolls the
            focused input into view — the operator should never lose
            sight of which parameter they're on (UX feedback: "I don't
            even know the current reading I'm taking"). */}
        <div className="sticky -top-4 z-10 -mx-4 mb-1 bg-background px-4 pb-1 pt-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{parameter.name}</h2>
            {isCritical && (
              <AlertOctagon className="h-5 w-5 shrink-0 text-destructive" aria-label="Critical" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {parameter.equipment_name ?? parameter.group_name ?? parameter.system_name}
            {parameter.unit ? ` · ${parameter.unit}` : ""}
          </p>
        </div>

        {/* Previous reading + acceptable range, always visible so the
            operator has context before typing (UX review). */}
        <div className="mb-3 rounded-lg border border-border bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Previous reading</span>
            {trend && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {trend === "up" && <ArrowUp className="h-3.5 w-3.5" />}
                {trend === "down" && <ArrowDown className="h-3.5 w-3.5" />}
                {trend === "flat" && <ArrowRight className="h-3.5 w-3.5" />}
                trend
              </span>
            )}
          </div>
          <p className="mb-2 text-2xl font-semibold tabular-nums">
            {parameter.last_value_numeric ??
              parameter.last_value_categorical ??
              parameter.last_mode_value ??
              "—"}
          </p>
          {parameter.last_entered_at && (
            <p className="mb-2 text-xs text-muted-foreground">
              {(parameter.last_was_critical && "Was critical") ||
                (parameter.last_was_out_of_range && "Was out of range") ||
                "Last logged"}
            </p>
          )}

          {/* Collapsed by default (UX feedback, Aug 2026: "screen resolution
              to prevent scrolling before confirming" — the sparkline/range
              were pushing the actual input and Confirm button below the
              fold on shorter phones). One tap brings them back. */}
          {(acceptableRange || (history && history.length > 0)) && (
            <button
              type="button"
              onClick={() => setShowMoreContext((o) => !o)}
              aria-expanded={showMoreContext}
              className="mt-1 text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
            >
              {showMoreContext ? "Hide trend & range" : "Show trend & range"}
            </button>
          )}

          {showMoreContext && (
            <div className="mt-2">
              {history && history.length > 0 && (
                <Sparkline points={history.map((h) => h.value_numeric ?? 0)} />
              )}
              {acceptableRange && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Acceptable range:{" "}
                  <span className="font-medium text-foreground">{acceptableRange}</span>
                </p>
              )}
            </div>
          )}

          <ReadingHistoryPanel
            parameter={parameter}
            className="mt-2 border-t border-border pt-1.5"
          />
        </div>

        {/* Value entry — the visual focus of the screen (UX review: "Move
            the reading input field to the center of the screen"). */}
        <div className="flex flex-1 flex-col items-center justify-center py-4">
          <div className="w-full max-w-sm">
            {parameter.track_mode_changes ? (
              <div>
                <p className="mb-2 text-center text-sm font-medium">Select mode</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {(parameter.valid_options ?? []).map((option) => (
                    <Button
                      key={option}
                      type="button"
                      size="touch44"
                      variant={draftMode === option ? "default" : "outline"}
                      onClick={() => stageMode(option)}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              </div>
            ) : parameter.field_type === "numeric" ? (
              <div>
                <label className="mb-1 block text-center text-xs font-medium text-muted-foreground">
                  {parameter.name} — enter value
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={draftNumeric}
                  onChange={(e) => stageNumeric(e.target.value)}
                  onKeyDown={(e) => {
                    // UX feedback, Aug 2026: "Enter key on keyboard to
                    // confirm and take you to next page" — mainly for the
                    // shared device's attached hardware keypad, but also
                    // fires from a phone's on-screen "Go"/"Next" key.
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    if (canConfirm) handleConfirmAndNext();
                  }}
                  className="min-h-16 w-full rounded-lg border border-input bg-background px-4 text-center text-3xl font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            ) : (
              <div className="flex flex-wrap justify-center gap-2">
                {(parameter.valid_options ?? []).map((option) => (
                  <Button
                    key={option}
                    type="button"
                    size="touch44"
                    variant={draftCategorical === option ? "default" : "outline"}
                    onClick={() => stageCategorical(option)}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            )}

            {gaugePercent != null && (
              <div className="mt-4">
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-2 rounded-full",
                      isCritical
                        ? "bg-destructive"
                        : staged?.previewOutOfRange
                          ? "bg-warning"
                          : "bg-primary",
                    )}
                    style={{ width: `${gaugePercent}%` }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>{min}</span>
                  <span>{max}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {staged?.previewOutOfRange && (
          <div
            className={cn(
              "mb-3 rounded-md p-3 text-sm",
              isCritical
                ? "bg-destructive/10 text-destructive"
                : "bg-warning/15 text-warning-foreground",
            )}
          >
            <p className="font-medium">{isCritical ? "Critical threshold" : "Out of range"}</p>
            <p className="text-xs opacity-90">
              This value is outside the normal range for this parameter. You can still confirm it.
            </p>
          </div>
        )}

        {/* Technician confirmation — shared devices only. */}
        {deviceContext === "shared" && (
          <label className="mb-2 flex min-h-11 items-center gap-2 rounded-md border border-border p-3 text-sm">
            <input
              type="checkbox"
              checked={technicianAcknowledged}
              onChange={(e) => setTechnicianAcknowledged(e.target.checked)}
              className="h-5 w-5"
            />
            Logged by <span className="font-medium">{operatorName}</span> — this is me
          </label>
        )}
      </div>

      <div className="shrink-0 border-t border-border p-4 pb-safe">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="min-h-11 shrink-0"
            disabled={isFirst}
            onClick={onPrevious}
            aria-label="Previous parameter"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="min-h-11 flex-1 text-muted-foreground"
            onClick={onSkip}
          >
            Skip for now
          </Button>
          <Button
            type="button"
            size="lg"
            className="min-h-11 flex-[2]"
            disabled={!canConfirm}
            onClick={handleConfirmAndNext}
          >
            {isLast ? "Confirm" : "Confirm & Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 200;
  const h = 32;
  const step = w / (points.length - 1);
  const coords = points.map((p, i) => `${i * step},${h - ((p - min) / range) * h}`).join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-8 w-full text-muted-foreground"
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline points={coords} fill="none" stroke="currentColor" strokeWidth={2} />
    </svg>
  );
}
