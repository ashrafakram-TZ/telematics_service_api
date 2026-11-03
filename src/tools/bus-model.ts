import { RecordedRoute } from './chennai-routes';
import { buildPath, distanceToNext, positionAt, RoutePath } from './route-math';

export type Phase = 'cruise' | 'dwell' | 'parked';
export type Random = () => number;

export interface GpsMessage {
  ts: number;
  lat: number;
  lng: number;
  spd: number;
  hdg: number;
  ign: 0 | 1;
  odo: number;
  fuel: number;
  bat: number;
  volt: number;
  evt?: 'harsh_brake' | 'harsh_accel';
}

export interface ObdMessage {
  ts: number;
  rpm: number;
  spd: number;
  coolant: number;
  load: number;
  throttle: number;
  fuel: number;
  volt: number;
  odo: number;
  dtc: string[];
}

export interface BusOptions {
  startFraction?: number;
  fuel?: number;
  odometerKm?: number;
  faults?: boolean;
  random?: Random;
}

const AMBIENT_C = 32;
const BRAKE_MPS2 = 1.2;
const ACCEL_MPS2 = 0.9;
const FUEL_PCT_PER_M = 0.00025;
const IDLE_FUEL_PCT_PER_S = 0.0004;
const HARSH_BRAKE_CHANCE = 0.003;
const HARSH_LAUNCH_CHANCE = 0.08;
const SIGNAL_CHANCE = 0.006;
const OVERHEAT_DTC = 'P0217';

const round = (value: number, digits = 1) => Number(value.toFixed(digits));

export class SimulatedBus {
  phase: Phase = 'dwell';
  speed = 0;
  private path: RoutePath;
  private stops: number[];
  private meters = 0;
  private phaseLeft = 10;
  private cruiseTarget = 35;
  private targetLeft = 0;
  private fuel: number;
  private odometerKm: number;
  private coolant = AMBIENT_C + 20;
  private runningSeconds = 0;
  private accelerating = false;
  private hardLaunch = false;
  private event: GpsMessage['evt'];
  private readonly random: Random;
  private readonly faults: boolean;

  constructor(
    readonly imei: string,
    readonly route: RecordedRoute,
    options: BusOptions = {},
  ) {
    this.random = options.random ?? Math.random;
    this.faults = options.faults ?? false;
    this.fuel = options.fuel ?? 60 + this.random() * 30;
    this.odometerKm = options.odometerKm ?? 20000 + Math.floor(this.random() * 30000);
    this.path = buildPath(route.points);
    this.stops = route.stops.map((stop) => stop.index);
    this.meters = this.path.length * Math.min(Math.max(options.startFraction ?? 0, 0), 0.95);
  }

  get distance(): number {
    return this.meters;
  }

  advance(seconds: number): void {
    this.event = undefined;
    for (let i = 0; i < Math.max(1, Math.round(seconds)); i += 1) this.tick();
  }

  gps(now: Date): GpsMessage {
    const position = positionAt(this.path, this.meters);
    const running = this.phase !== 'parked';
    return {
      ts: Math.floor(now.getTime() / 1000),
      lat: position.lat,
      lng: position.lng,
      spd: round(this.speed),
      hdg: position.heading,
      ign: running ? 1 : 0,
      odo: round(this.odometerKm),
      fuel: round(this.fuel),
      bat: running ? 96 : 88,
      volt: this.voltage(),
      ...(this.event ? { evt: this.event } : {}),
    };
  }

  obd(now: Date): ObdMessage {
    const running = this.phase !== 'parked';
    const moving = this.speed > 2;
    const rpm = !running ? 0 : moving ? this.movingRpm() : 700 + this.random() * 80;
    const load = !running
      ? 0
      : this.accelerating
        ? 55 + this.random() * 25
        : moving
          ? 28 + this.random() * 20
          : 18 + this.random() * 6;
    const throttle = !running
      ? 0
      : this.accelerating
        ? 30 + this.random() * 25
        : moving
          ? 12 + this.random() * 12
          : this.random() * 2;
    return {
      ts: Math.floor(now.getTime() / 1000),
      rpm: Math.round(rpm),
      spd: Math.round(this.speed),
      coolant: round(this.coolant),
      load: round(load),
      throttle: round(throttle),
      fuel: round(this.fuel),
      volt: this.voltage(),
      odo: round(this.odometerKm),
      dtc: this.overheating() ? [OVERHEAT_DTC] : [],
    };
  }

  private tick(): void {
    if (this.phase === 'parked') return this.parkedTick();
    this.runningSeconds += 1;
    this.warmEngine();
    if (this.phase === 'dwell') return this.dwellTick();
    this.cruiseTick();
  }

  private parkedTick(): void {
    this.speed = 0;
    this.accelerating = false;
    this.coolant -= (this.coolant - AMBIENT_C) * 0.004;
    this.phaseLeft -= 1;
    if (this.phaseLeft > 0) return;
    this.path = buildPath([...this.path.points].reverse());
    this.stops = this.stops.map((index) => this.path.points.length - 1 - index);
    this.meters = 0;
    if (this.fuel < 20) this.fuel = 90;
    this.startDwell(15);
  }

  private dwellTick(): void {
    this.speed = 0;
    this.accelerating = false;
    this.fuel = Math.max(0, this.fuel - IDLE_FUEL_PCT_PER_S);
    this.phaseLeft -= 1;
    if (this.phaseLeft > 0) return;
    this.phase = 'cruise';
    this.hardLaunch = this.random() < HARSH_LAUNCH_CHANCE;
  }

  private cruiseTick(): void {
    this.targetLeft -= 1;
    if (this.targetLeft <= 0) {
      this.cruiseTarget = 26 + this.random() * 20;
      this.targetLeft = 20 + Math.floor(this.random() * 40);
    }
    const gap = distanceToNext(this.path, this.meters, this.stops) ?? this.path.length - this.meters;
    const brakeLimit = Math.sqrt(2 * BRAKE_MPS2 * Math.max(gap - 2, 0)) * 3.6;
    const previous = this.speed;
    const jitter = (this.random() - 0.5) * 3;
    let next = Math.min(this.cruiseTarget + jitter, previous + ACCEL_MPS2 * 3.6, brakeLimit + 3);
    if (previous > 25 && this.random() < HARSH_BRAKE_CHANCE) {
      next = Math.max(0, previous - 16);
      this.event = 'harsh_brake';
    } else if (this.hardLaunch && previous < 15 && brakeLimit > 20) {
      next = Math.min(this.cruiseTarget, previous + 12);
      this.event = 'harsh_accel';
    }
    this.hardLaunch = false;
    this.accelerating = next > previous + 1;
    this.speed = Math.max(0, next);
    const step = Math.min((this.speed / 3.6) * 1, gap);
    this.meters += step;
    this.odometerKm += step / 1000;
    this.fuel = Math.max(0, this.fuel - step * FUEL_PCT_PER_M - IDLE_FUEL_PCT_PER_S);
    if (this.meters >= this.path.length - 0.5) {
      this.meters = this.path.length;
      this.speed = 0;
      this.phase = 'parked';
      this.phaseLeft = 60 + Math.floor(this.random() * 60);
      return;
    }
    if (gap - step <= 0.5) return this.startDwell(20 + Math.floor(this.random() * 20));
    if (this.speed > 15 && this.random() < SIGNAL_CHANCE) this.startDwell(15 + Math.floor(this.random() * 30));
  }

  private startDwell(seconds: number): void {
    this.phase = 'dwell';
    this.speed = 0;
    this.phaseLeft = seconds;
  }

  private warmEngine(): void {
    const target = this.overheating() ? 109 : 89 + this.random() * 3;
    this.coolant += (target - this.coolant) * (this.overheating() ? 0.03 : 0.01);
  }

  private overheating(): boolean {
    return this.faults && this.runningSeconds > 60 && this.phase !== 'parked';
  }

  private movingRpm(): number {
    const gearSpan = 18;
    const inGear = this.speed % gearSpan;
    return Math.min(2600, 950 + inGear * 60 + this.speed * 6 + (this.accelerating ? 250 : 0));
  }

  private voltage(): number {
    return this.phase === 'parked' ? round(12.4 + this.random() * 0.2, 2) : round(13.8 + this.random() * 0.4, 2);
  }
}
