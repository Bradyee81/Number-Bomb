// Per-round one-shot gate. Undo/reveal/rendering cannot restore an arm or shot.
export class PopperGate {
  round = "";
  armed = false;
  consumed = false;
  begin(round: string) { this.round = round; this.armed = false; this.consumed = false; }
  disarm() { this.armed = false; }
  arm(round: string) {
    if (!round || round !== this.round || this.consumed) return false;
    this.armed = true;
    return true;
  }
  consume() {
    if (!this.armed || this.consumed || !this.round) return null;
    this.armed = false;
    this.consumed = true;
    return this.round;
  }
  finish() {
    const shot = this.consume();
    this.armed = false;
    this.consumed = true;
    return shot;
  }
}
