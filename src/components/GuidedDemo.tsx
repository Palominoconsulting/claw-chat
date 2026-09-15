import type { GuideProgress, GuideStep } from "../lib/guidedDemo.js";
import { Button } from "./Primitives.js";

type GuideTab = "Chat" | "Runs" | "Decisions" | "Context";
const instructions: Record<
  GuideStep,
  { title: string; hint: string; tab?: GuideTab }
> = {
  unavailable: {
    title: "Demo only",
    hint: "Guided practice is unavailable for live connections.",
  },
  select: {
    title: "Select a sample excerpt",
    hint: "In Chat, check a sample message such as m1. You choose exactly what becomes context.",
    tab: "Chat",
  },
  "create-project": {
    title: "Give the excerpt a home",
    hint: "Choose Preview excerpts, read the selection, keep Destination on Create a new project, then Create project. Existing projects stay outside this practice.",
    tab: "Chat",
  },
  "create-stage": {
    title: "Define your first demo stage",
    hint: "In Runs, read or edit the sample objectives and acceptance criteria, then choose Create stage. This does not start work.",
    tab: "Runs",
  },
  "start-stage": {
    title: "Preview, then start deliberately",
    hint: "Use Preview & start stage. Read the exact packet and tasks, confirm your review, then Start simulated stage.",
    tab: "Runs",
  },
  wait: {
    title: "Your simulated stage is running",
    hint: "Wait for the task results here. Completed means the simulation returned, not that its findings are correct.",
    tab: "Runs",
  },
  inspect: {
    title: "Inspect each actual result",
    hint: "In Runs, choose Inspect, then Next result to open each actual output and launch snapshot. Read the acceptance criteria. Review checkpoint returns to Decisions; it does not approve.",
    tab: "Runs",
  },
  review: {
    title: "Review the current checkpoint yourself",
    hint: "In Decisions, examine every output, assess the proposal and add your review note. Approve only if warranted; Request changes or Reject are valid outcomes. Approval never starts a successor.",
    tab: "Decisions",
  },
  changes: {
    title: "Changes requested",
    hint: "Revisit the proposal in Decisions and save a new revision if needed. Review that current revision yourself. There is no need to approve just to finish a guide.",
    tab: "Decisions",
  },
  rejected: {
    title: "You rejected this checkpoint",
    hint: "The successor stays locked. You can keep exploring or restart with a fresh practice project; this guide will not override your decision.",
    tab: "Decisions",
  },
  stale: {
    title: "The context changed",
    hint: "The old checkpoint cannot authorize this context. Inspect the stale state in Decisions; restart this practice for a fresh flow. Nothing is retried automatically.",
    tab: "Decisions",
  },
  blocked: {
    title: "This practice needs attention",
    hint: "Check the project and task status before continuing. Missing or unresolved results are not success. Restart creates a fresh guide without deleting or retrying existing work.",
  },
  "create-successor": {
    title: "Define a separate successor",
    hint: "Approval is recorded for the current revision. In Runs, choose + Add stage, review the dependent task and Create stage. It will remain unstarted.",
    tab: "Runs",
  },
  "start-successor": {
    title: "Start the successor separately",
    hint: "In Runs, use the successor’s Preview & start stage. Review and confirm its packet, then explicitly Start simulated stage. Your checkpoint approval did not launch it.",
    tab: "Runs",
  },
  complete: {
    title: "You practiced the whole handoff",
    hint: "You selected context, inspected results, reviewed a checkpoint and explicitly started its successor. Synthetic practice only; this does not verify real-world findings or live Gateway compatibility.",
  },
};
export function GuidedDemo({
  progress,
  tab,
  elsewhere,
  busy,
  onNavigate,
  onReturn,
  onDismiss,
  onRestart,
}: {
  progress: GuideProgress;
  tab: GuideTab;
  elsewhere: boolean;
  busy: boolean;
  onNavigate: (tab: GuideTab) => void;
  onReturn: () => void;
  onDismiss: () => void;
  onRestart: () => void;
}) {
  const instruction = instructions[progress.step];
  return (
    <section
      className="guided-demo"
      aria-label="Learn by doing"
      data-step={progress.step}
    >
      <div className="guided-demo-copy">
        <small>
          SYNTHETIC PRACTICE · No model calls · {progress.completed}/6 actions
        </small>
        <h3>{elsewhere ? "Return to your practice" : instruction.title}</h3>
        <p>
          {elsewhere
            ? "Other projects do not count toward this guide. Return to the practice project or restart with a fresh selection."
            : instruction.hint}
        </p>
        {!elsewhere && progress.remainingResults && (
          <p className="guide-remaining">
            Still to inspect: {progress.remainingResults.join("; ")}
          </p>
        )}
      </div>
      <div className="guided-demo-actions">
        {elsewhere ? (
          <Button isDisabled={busy} onPress={onReturn}>
            Return to practice
          </Button>
        ) : instruction.tab && instruction.tab !== tab ? (
          <Button onPress={() => onNavigate(instruction.tab!)}>
            Open {instruction.tab}
          </Button>
        ) : null}
        <Button variant="ghost" isDisabled={busy} onPress={onRestart}>
          Restart practice
        </Button>
        <Button variant="ghost" onPress={onDismiss}>
          {progress.step === "complete" ? "Finish practice" : "Skip guide"}
        </Button>
      </div>
    </section>
  );
}
