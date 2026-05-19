export const DEFAULT_FLIGHT_KEYMAP = {
  forward: ["KeyW"],
  backward: ["KeyS"],
  left: ["KeyA"],
  right: ["KeyD"],
  up: ["Space"],
  down: ["KeyC"],
  rollLeft: ["KeyQ"],
  rollRight: ["KeyE"],
  sprint: ["ShiftLeft", "ShiftRight"],
  exit: ["Escape", "AltLeft", "AltRight"],
};

const MOVE_INTENTS = new Set(["forward", "backward", "left", "right", "up", "down", "rollLeft", "rollRight"]);

function flattenKeymap(keymap) {
  const map = new Map();
  for (const [intent, codes] of Object.entries(keymap)) {
    for (const code of codes) map.set(code, intent);
  }
  return map;
}

export function keyIntentForCode(code, keymap = DEFAULT_FLIGHT_KEYMAP) {
  return flattenKeymap(keymap).get(code) || null;
}

export function isFlightControlKey(code, keymap = DEFAULT_FLIGHT_KEYMAP) {
  return keyIntentForCode(code, keymap) !== null;
}

function isEditableTarget(target) {
  const tagName = target?.tagName;
  return target?.isContentEditable
    || tagName === "INPUT"
    || tagName === "TEXTAREA"
    || tagName === "SELECT";
}

function lerpAlpha(rate, dtScale) {
  return 1 - Math.pow(1 - rate, Math.max(0.001, dtScale));
}

export class FlightControls {
  constructor(options = {}) {
    if (!options.THREE) throw new TypeError("FlightControls requires a THREE namespace");
    this.THREE = options.THREE;
    this.camera = options.camera || null;
    this.domElement = options.domElement || null;
    this.document = options.ownerDocument || this.domElement?.ownerDocument || globalThis.document || null;
    this.window = options.ownerWindow || this.document?.defaultView || globalThis.window || null;
    this.enabled = options.enabled !== false;
    this.pointerLock = options.pointerLock !== false;
    this.exitWhenIdle = options.exitWhenIdle === true;
    this.keymap = options.keymap || DEFAULT_FLIGHT_KEYMAP;
    this.onModeChange = options.onModeChange || null;
    this.onPointerLockError = options.onPointerLockError || null;

    this.mouseSensitivity = options.mouseSensitivity ?? 0.0025;
    this.rollKeyRate = options.rollKeyRate ?? 0.025;
    this.maxSpeedFactor = options.maxSpeedFactor ?? 0.005;
    this.accelRate = options.accelRate ?? 0.08;
    this.decelRate = options.decelRate ?? 0.05;
    this.sprintMultiplier = options.sprintMultiplier ?? 3.0;
    this.speedMultiplier = options.speedMultiplier ?? 1.0;
    this.scaleMultiplier = options.scaleMultiplier ?? 1.0;
    this.restEpsilonSq = options.restEpsilonSq ?? 0.0001;

    this.active = false;
    this.pointerLockBlocked = false;
    this.heldIntents = new Set();
    this.pendingMouseDx = 0;
    this.pendingMouseDy = 0;

    this.position = new this.THREE.Vector3();
    this.velocity = new this.THREE.Vector3();
    this.orientation = new this.THREE.Quaternion();
    this.localUp = new this.THREE.Vector3(0, 1, 0);
    this.localRight = new this.THREE.Vector3(1, 0, 0);
    this.localForward = new this.THREE.Vector3(0, 0, -1);
    this.tmpQuat = new this.THREE.Quaternion();
    this.tmpForward = new this.THREE.Vector3();
    this.tmpRight = new this.THREE.Vector3();
    this.tmpUp = new this.THREE.Vector3();
    this.tmpDesired = new this.THREE.Vector3();

    this.bound = {
      keydown: (event) => this.handleKeyDown(event),
      keyup: (event) => this.handleKeyUp(event),
      mousemove: (event) => this.handleMouseMove(event),
      blur: () => this.clearInput(),
      pointerlockchange: () => this.handlePointerLockChange(),
    };

    if (options.autoBind) this.bind();
  }

  bind() {
    this.window?.addEventListener("keydown", this.bound.keydown);
    this.window?.addEventListener("keyup", this.bound.keyup);
    this.window?.addEventListener("mousemove", this.bound.mousemove);
    this.window?.addEventListener("blur", this.bound.blur);
    this.document?.addEventListener("pointerlockchange", this.bound.pointerlockchange);
    return this;
  }

  dispose() {
    this.exit({ releasePointerLock: true });
    this.window?.removeEventListener("keydown", this.bound.keydown);
    this.window?.removeEventListener("keyup", this.bound.keyup);
    this.window?.removeEventListener("mousemove", this.bound.mousemove);
    this.window?.removeEventListener("blur", this.bound.blur);
    this.document?.removeEventListener("pointerlockchange", this.bound.pointerlockchange);
  }

  enter(state = {}) {
    if (!this.enabled) return false;
    if (state.position) this.position.copy(state.position);
    else if (this.camera) this.position.copy(this.camera.position);
    if (state.orientation) this.orientation.copy(state.orientation);
    else if (this.camera) this.orientation.copy(this.camera.quaternion);
    this.velocity.set(0, 0, 0);
    this.active = true;
    this.requestPointerLock();
    this.onModeChange?.("flight");
    return true;
  }

  exit(options = {}) {
    if (!this.active) return false;
    this.active = false;
    this.clearInput();
    if (options.releasePointerLock !== false) this.releasePointerLock();
    this.onModeChange?.("orbit");
    return true;
  }

  clearInput() {
    this.heldIntents.clear();
    this.pendingMouseDx = 0;
    this.pendingMouseDy = 0;
    this.velocity.set(0, 0, 0);
  }

  requestPointerLock() {
    if (!this.pointerLock || !this.domElement || !this.document || this.pointerLockBlocked) return;
    if (this.document.pointerLockElement === this.domElement) return;
    try {
      const result = this.domElement.requestPointerLock?.();
      if (result && typeof result.catch === "function") {
        result.catch((err) => {
          this.pointerLockBlocked = true;
          this.onPointerLockError?.(err);
        });
      }
    } catch (err) {
      this.pointerLockBlocked = true;
      this.onPointerLockError?.(err);
    }
  }

  releasePointerLock() {
    if (!this.document || this.document.pointerLockElement !== this.domElement) return;
    try {
      this.document.exitPointerLock?.();
    } catch {
      // Browser-specific pointer-lock exits should not break cleanup.
    }
  }

  handlePointerLockChange() {
    if (this.active && this.pointerLock && this.document?.pointerLockElement !== this.domElement) {
      this.exit({ releasePointerLock: false });
    }
  }

  handleKeyDown(event) {
    if (!this.enabled || isEditableTarget(event.target)) return false;
    const intent = keyIntentForCode(event.code, this.keymap);
    if (!intent) return false;
    if (intent === "exit") {
      if (this.active) this.exit();
      return true;
    }
    if (intent === "sprint") {
      this.heldIntents.add(intent);
      return true;
    }
    if (MOVE_INTENTS.has(intent)) {
      if (!this.active) this.enter();
      this.heldIntents.add(intent);
      event.preventDefault?.();
      return true;
    }
    return false;
  }

  handleKeyUp(event) {
    const intent = keyIntentForCode(event.code, this.keymap);
    if (!intent) return false;
    this.heldIntents.delete(intent);
    if (this.exitWhenIdle && this.active && !this.hasMovementIntent()) this.exit();
    return true;
  }

  handleMouseMove(event) {
    if (!this.active) return false;
    this.pendingMouseDx += event.movementX || 0;
    this.pendingMouseDy += event.movementY || 0;
    return true;
  }

  hasMovementIntent() {
    for (const intent of this.heldIntents) {
      if (MOVE_INTENTS.has(intent)) return true;
    }
    return false;
  }

  setSpeed(multiplier) {
    const value = Number(multiplier);
    this.speedMultiplier = Number.isFinite(value) ? Math.max(0.05, Math.min(10, value)) : 1;
    return this;
  }

  setScaleMode(mode) {
    this.scaleMultiplier = mode === "big" ? 4.0 : 1.0;
    return this;
  }

  setState(state = {}) {
    if (state.position) this.position.copy(state.position);
    if (state.orientation) this.orientation.copy(state.orientation);
    if (state.velocity) this.velocity.copy(state.velocity);
    return this;
  }

  getState() {
    return {
      active: this.active,
      position: this.position.clone(),
      velocity: this.velocity.clone(),
      orientation: this.orientation.clone(),
      heldIntents: [...this.heldIntents],
    };
  }

  update(options = {}) {
    if (!this.active) return false;
    const dtScale = options.dt == null ? 1 : Math.max(0.001, options.dt * 60);
    const sprint = this.heldIntents.has("sprint") ? this.sprintMultiplier : 1.0;

    if (this.pendingMouseDx || this.pendingMouseDy) {
      if (this.pendingMouseDx) {
        this.tmpQuat.setFromAxisAngle(this.localUp, -this.pendingMouseDx * this.mouseSensitivity);
        this.orientation.multiply(this.tmpQuat);
      }
      if (this.pendingMouseDy) {
        this.tmpQuat.setFromAxisAngle(this.localRight, -this.pendingMouseDy * this.mouseSensitivity);
        this.orientation.multiply(this.tmpQuat);
      }
      this.pendingMouseDx = 0;
      this.pendingMouseDy = 0;
    }

    const rollRate = this.rollKeyRate * sprint * dtScale;
    if (this.heldIntents.has("rollLeft")) {
      this.tmpQuat.setFromAxisAngle(this.localForward, -rollRate);
      this.orientation.multiply(this.tmpQuat);
    }
    if (this.heldIntents.has("rollRight")) {
      this.tmpQuat.setFromAxisAngle(this.localForward, rollRate);
      this.orientation.multiply(this.tmpQuat);
    }

    this.tmpForward.copy(this.localForward).applyQuaternion(this.orientation);
    this.tmpRight.copy(this.localRight).applyQuaternion(this.orientation);
    this.tmpUp.copy(this.localUp).applyQuaternion(this.orientation);
    this.tmpDesired.set(0, 0, 0);
    if (this.heldIntents.has("forward")) this.tmpDesired.add(this.tmpForward);
    if (this.heldIntents.has("backward")) this.tmpDesired.sub(this.tmpForward);
    if (this.heldIntents.has("left")) this.tmpDesired.sub(this.tmpRight);
    if (this.heldIntents.has("right")) this.tmpDesired.add(this.tmpRight);
    if (this.heldIntents.has("up")) this.tmpDesired.add(this.tmpUp);
    if (this.heldIntents.has("down")) this.tmpDesired.sub(this.tmpUp);

    const accelerating = this.tmpDesired.lengthSq() > 0;
    if (accelerating) this.tmpDesired.normalize();
    const radius = Math.max(1, Number(options.radius) || 1);
    const maxSpeed = Math.max(1, radius * this.maxSpeedFactor * this.speedMultiplier * this.scaleMultiplier * sprint);
    this.tmpDesired.multiplyScalar(maxSpeed);
    this.velocity.lerp(this.tmpDesired, lerpAlpha(accelerating ? this.accelRate : this.decelRate, dtScale));

    if (this.velocity.lengthSq() > this.restEpsilonSq) this.position.addScaledVector(this.velocity, dtScale);
    else this.velocity.set(0, 0, 0);

    if (this.camera) {
      this.camera.position.copy(this.position);
      this.camera.quaternion.copy(this.orientation);
    }
    return true;
  }
}

export function createFlightControls(options) {
  return new FlightControls(options);
}
