export type PushToTalkGate = {
  live: boolean;
  pushToTalk: boolean;
};

export function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable="true"], [role="textbox"]',
    ),
  );
}

function isButtonOrLink(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('button, [role="button"], a[href]'));
}

export function shouldClaimSpace(
  event: Pick<KeyboardEvent, "code" | "repeat" | "target">,
  gate: PushToTalkGate,
) {
  return (
    gate.live &&
    gate.pushToTalk &&
    event.code === "Space" &&
    !event.repeat &&
    !isEditableTarget(event.target) &&
    !isButtonOrLink(event.target)
  );
}
