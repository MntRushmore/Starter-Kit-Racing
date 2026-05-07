import * as THREE from 'three';
import { nearestWaypointIndex } from './Waypoints.js';
import { MAX_SPEED } from './Vehicle.js';

const _toPoint = new THREE.Vector3();
const _localOffset = new THREE.Vector3();
const _invQuat = new THREE.Quaternion();
const _aimWorld = new THREE.Vector3();
const _segDir = new THREE.Vector3();
const _segPerp = new THREE.Vector3();

export const DIFFICULTY = {
	easy:   { speedCap: 0.78, steerGain: 3.6, brakeAggression: 0.7, lookahead: 2, noise: 0.10, lineBias: 0.30 },
	medium: { speedCap: 0.92, steerGain: 4.5, brakeAggression: 1.0, lookahead: 2, noise: 0.06, lineBias: 0.55 },
	hard:   { speedCap: 1.00, steerGain: 5.4, brakeAggression: 1.3, lookahead: 3, noise: 0.03, lineBias: 0.75 },
};

const ARRIVE_RADIUS = 4.5;          // ~0.6 cells
const STUCK_SPEED = 0.08;
const STUCK_TIME = 1.2;
const RECOVERY_TIME = 0.7;

export class AIController {

	constructor( vehicle, waypoints, options = {} ) {

		this.vehicle = vehicle;
		this.waypoints = waypoints;

		const profile = DIFFICULTY[ options.difficulty || 'medium' ];
		this.speedCap = profile.speedCap;
		this.steerGain = profile.steerGain;
		this.brakeAggression = profile.brakeAggression;
		this.lookahead = profile.lookahead;
		this.noise = profile.noise;
		this.lineBias = profile.lineBias;

		this.seed = options.seed ?? Math.random() * 1000;
		this.aimIndex = waypoints.finishIndex;
		this.elapsed = 0;

		this.stuckTime = 0;
		this.recoveryTime = 0;
		this.lastSteer = 0;

		// Per-AI lateral offset so cars take slightly different lines.
		this.lateralOffset = ( ( ( this.seed | 0 ) % 7 ) - 3 ) * 0.25;

	}

	// Apex-aware aim: bias toward the inside of an upcoming corner.
	computeAim( idx ) {

		const points = this.waypoints.points;
		const n = points.length;

		const a = points[ ( idx - 1 + n ) % n ];
		const b = points[ idx ];
		const c = points[ ( idx + 1 ) % n ];

		// Inside-of-corner direction: bisector of incoming + outgoing edges, flipped.
		const inDx = b.x - a.x, inDz = b.z - a.z;
		const outDx = c.x - b.x, outDz = c.z - b.z;

		// Cross product sign tells us which side the corner bends toward.
		const cross = inDx * outDz - inDz * outDx;
		const turnAmount = Math.abs( cross );

		// Perpendicular to incoming edge, normalized.
		const lenIn = Math.hypot( inDx, inDz ) || 1;
		const perpX = - inDz / lenIn;
		const perpZ =   inDx / lenIn;
		const sign = Math.sign( cross );

		// Push aim toward the inside of the corner proportional to turn amount.
		const apexShift = Math.min( 1.5, turnAmount * 0.05 ) * this.lineBias * sign;
		_aimWorld.set( b.x + perpX * apexShift, b.y, b.z + perpZ * apexShift );
		return _aimWorld;

	}

	update( dt ) {

		this.elapsed += dt;

		const points = this.waypoints.points;
		const n = points.length;
		const pos = this.vehicle.spherePos;

		// --- 1. Advance aim index ---
		_invQuat.copy( this.vehicle.container.quaternion ).invert();

		_toPoint.copy( points[ this.aimIndex ] ).sub( pos );
		_localOffset.copy( _toPoint ).applyQuaternion( _invQuat );

		const closeEnough = _toPoint.lengthSq() < ARRIVE_RADIUS * ARRIVE_RADIUS;
		const passed = _localOffset.z < 1.5;        // a bit of forward slack

		if ( closeEnough || passed ) {

			this.aimIndex = ( this.aimIndex + 1 ) % n;

		}

		// --- 2. Compute aim point with apex bias ---
		const apex = this.computeAim( this.aimIndex );
		_toPoint.copy( apex ).sub( pos );
		_localOffset.copy( _toPoint ).applyQuaternion( _invQuat );

		// --- 3. Steering ---
		const lateral = _localOffset.x;
		const forward = Math.max( 0.5, _localOffset.z );

		// Angle to target, clamped. atan2 gives a true angle so steering scales sanely.
		const targetAngle = Math.atan2( lateral, forward );
		let steer = THREE.MathUtils.clamp( targetAngle * this.steerGain / Math.PI, -1, 1 );

		// Damping: blend with previous steering so we don't oscillate violently.
		steer = this.lastSteer * 0.4 + steer * 0.6;

		// Per-AI noise so multiple AIs don't drive identical lines.
		steer += Math.sin( this.elapsed * 1.7 + this.seed ) * this.noise;

		// If target is fully behind us, hard turn toward it.
		if ( _localOffset.z < 0 ) steer = Math.sign( lateral || 1 );

		steer = THREE.MathUtils.clamp( steer, -1, 1 );
		this.lastSteer = steer;

		// --- 4. Throttle: speed-aware predictive braking ---
		const sharpness = this.computeSharpness();
		const currentSpeed = this.vehicle.linearSpeed;

		// Target speed for the upcoming corner: lower for sharper turns.
		const cornerSpeed = MAX_SPEED * this.speedCap * THREE.MathUtils.clamp( 1 - sharpness * 0.45, 0.45, 1 );

		let throttle;
		if ( currentSpeed > cornerSpeed * 1.05 ) {

			// Going too fast for the corner — brake.
			throttle = -this.brakeAggression;

		} else if ( currentSpeed < cornerSpeed * 0.85 ) {

			// Below target, full gas.
			throttle = this.speedCap;

		} else {

			// In the sweet spot — light coast.
			throttle = this.speedCap * 0.7;

		}

		// --- 5. Stuck recovery ---
		const speed = Math.abs( currentSpeed );
		if ( this.recoveryTime > 0 ) {

			this.recoveryTime -= dt;
			throttle = -1;
			steer = -this.lastSteer * 0.5;        // counter-steer to unwedge
			this.lastSteer = steer;

		} else if ( speed < STUCK_SPEED && throttle > 0.4 ) {

			this.stuckTime += dt;
			if ( this.stuckTime > STUCK_TIME ) {

				this.recoveryTime = RECOVERY_TIME;
				this.stuckTime = 0;

			}

		} else {

			this.stuckTime = Math.max( 0, this.stuckTime - dt );

		}

		return { x: steer, z: throttle, touchActive: false };

	}

	// Sum of bend angles in the next N waypoint segments (radians).
	computeSharpness() {

		const points = this.waypoints.points;
		const n = points.length;

		let total = 0;

		for ( let k = 0; k <= this.lookahead; k ++ ) {

			const i0 = ( this.aimIndex + k ) % n;
			const i1 = ( this.aimIndex + k + 1 ) % n;
			const i2 = ( this.aimIndex + k + 2 ) % n;

			const ax = points[ i1 ].x - points[ i0 ].x;
			const az = points[ i1 ].z - points[ i0 ].z;
			const bx = points[ i2 ].x - points[ i1 ].x;
			const bz = points[ i2 ].z - points[ i1 ].z;

			const dot = ax * bx + az * bz;
			const cross = ax * bz - az * bx;
			const angle = Math.abs( Math.atan2( cross, dot ) );
			total += angle;

		}

		return total;

	}

	progress() {

		const idx = nearestWaypointIndex( this.waypoints.points, this.vehicle.spherePos, this.aimIndex );
		return { aimIndex: idx };

	}

}
