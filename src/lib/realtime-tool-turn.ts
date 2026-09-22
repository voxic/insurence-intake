type FunctionOutput = {
  callId: string;
  output: unknown;
};

type ToolTurnOptions = {
  run: (callId: string, name: string | null, argumentsJson: unknown) => Promise<unknown>;
  sendOutput: (output: FunctionOutput) => void;
  continueResponse: () => void;
  waitForPlayback: () => Promise<void>;
};

export class RealtimeToolTurn {
  private pending = 0;
  private hasToolCalls = false;
  private responseDone = false;
  private continued = false;
  private generation = 0;

  constructor(private readonly options: ToolTurnOptions) {}

  handle(callId: string | null, name: string | null, argumentsJson: unknown) {
    if (!callId) return;
    const generation = this.generation;
    this.pending += 1;
    this.hasToolCalls = true;
    void this.options
      .run(callId, name, argumentsJson)
      .catch(() => ({ error: "The live intake tool could not be completed." }))
      .then((output) => {
        if (generation !== this.generation) return;
        this.options.sendOutput({ callId, output });
      })
      .finally(() => {
        if (generation !== this.generation) return;
        this.pending -= 1;
        void this.maybeContinue(generation);
      });
  }

  markResponseDone() {
    this.responseDone = true;
    void this.maybeContinue(this.generation);
  }

  interrupt() {
    this.generation += 1;
    this.pending = 0;
    this.hasToolCalls = false;
    this.responseDone = false;
    this.continued = false;
  }

  private async maybeContinue(generation: number) {
    if (
      generation !== this.generation ||
      !this.hasToolCalls ||
      !this.responseDone ||
      this.pending !== 0 ||
      this.continued
    ) {
      return;
    }
    this.continued = true;
    await this.options.waitForPlayback();
    if (generation === this.generation) this.options.continueResponse();
  }
}
