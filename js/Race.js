import * as THREE from 'three';
import { Vehicle } from './Vehicle.js';
import { createSphereBody } from './Physics.js';
import { computeSpawnPosition, TRACK_CELLS } from './Track.js';
import { buildWaypoints, nearestWaypointIndex } from './Waypoints.js';
import { LapTracker } from './LapTracker.js';
import { AIController } from './AIController.js';

const COUNTDOWN_DURATION = 3.5;     // 3, 2, 1, GO (last beat is short)
const POST_PLAYER_TIMEOUT = 2;      // race ends 2s after player finishes

export const COLOR_KEYS = [
	{ key: 'vehicle-truck-yellow', name: 'Yellow' },
	{ key: 'vehicle-truck-red',    name: 'Red' },
	{ key: 'vehicle-truck-green',  name: 'Green' },
	{ key: 'vehicle-truck-purple', name: 'Purple' },
];

export class Race {

	constructor( { scene, world, models, cells, settings } ) {

		this.scene = scene;
		this.world = world;
		this.models = models;
		this.cells = cells || TRACK_CELLS;
		this.settings = settings;

		this.state = 'countdown';
		this.countdownRemaining = COUNTDOWN_DURATION;
		this.elapsed = 0;
		this.playerFinishedAt = null;

		this.waypoints = buildWaypoints( this.cells );
		this.entries = [];
		this.finishOrder = [];

		this.spawn = computeSpawnPosition( this.cells );
		this.buildEntries();

	}

	buildEntries() {

		const playerColorKey = this.settings.playerColor || COLOR_KEYS[ 0 ].key;

		// Build color list: player first, then AI in remaining colors.
		const aiColors = COLOR_KEYS.filter( c => c.key !== playerColorKey );
		const totalCars = 1 + this.settings.aiCount;
		const usedColors = [ COLOR_KEYS.find( c => c.key === playerColorKey ) ];
		for ( let i = 0; i < this.settings.aiCount; i ++ ) usedColors.push( aiColors[ i % aiColors.length ] );

		// Grid: 2 columns spaced laterally, rows spaced longitudinally behind finish.
		const fx = Math.sin( this.spawn.angle );
		const fz = Math.cos( this.spawn.angle );
		const rx = fz;        // right vector = (forward.z, -forward.x)
		const rz = -fx;
		const baseX = this.spawn.position[ 0 ];
		const baseZ = this.spawn.position[ 2 ];

		for ( let i = 0; i < totalCars; i ++ ) {

			const isPlayer = i === 0;
			const lateral = ( ( i % 2 ) * 2 - 1 ) * 1.4;
			const back = Math.floor( i / 2 ) * 2.6;
			const sx = baseX - fx * back + rx * lateral;
			const sz = baseZ - fz * back + rz * lateral;

			const body = createSphereBody( this.world, [ sx, 0.5, sz ] );
			const vehicle = new Vehicle();
			vehicle.rigidBody = body;
			vehicle.physicsWorld = this.world;
			vehicle.spherePos.set( sx, 0.5, sz );
			vehicle.prevModelPos.set( sx, 0, sz );
			vehicle.container.rotation.y = this.spawn.angle;

			const modelKey = usedColors[ i ].key;
			const group = vehicle.init( this.models[ modelKey ] );
			this.scene.add( group );

			const lapTracker = new LapTracker( this.cells );
			let aiCtrl = null;
			if ( ! isPlayer ) {

				aiCtrl = new AIController( vehicle, this.waypoints, {
					difficulty: this.settings.difficulty,
					seed: i * 137.7,
				} );

			}

			this.entries.push( {
				vehicle,
				body,
				group,
				isPlayer,
				colorKey: modelKey,
				colorName: usedColors[ i ].name,
				lapTracker,
				aiCtrl,
				finishedAt: null,
				totalTime: 0,
				lastWpIdx: this.waypoints ? this.waypoints.finishIndex : 0,
			} );

		}

	}

	get player() { return this.entries[ 0 ]; }

	// Drive every vehicle's input source. Caller still steps physics and
	// calls vehicle.update for the player; we delegate AI input via this method.
	// Returns the player's input (so caller can wire camera/audio against it).
	tick( dt, playerInput ) {

		this.elapsed += dt;

		let activeInput = playerInput;

		if ( this.state === 'countdown' ) {

			this.countdownRemaining -= dt;
			activeInput = { x: 0, z: 0, touchActive: false };

			if ( this.countdownRemaining <= 0 ) {

				this.state = 'racing';
				for ( const e of this.entries ) e.lapTracker.start();

			}

		}

		// Update player vehicle from caller; AI cars from controllers.
		this.player.vehicle.update( dt, activeInput );

		for ( const e of this.entries ) {

			if ( e.isPlayer ) continue;
			const aiInput = this.state === 'countdown'
				? { x: 0, z: 0, touchActive: false }
				: e.aiCtrl.update( dt );
			e.vehicle.update( dt, aiInput );

		}

		if ( this.state === 'racing' ) {

			for ( const e of this.entries ) {

				if ( e.finishedAt !== null ) continue;
				const ev = e.lapTracker.update( dt, e.vehicle.spherePos );
				if ( ev && e.lapTracker.lapsCompleted >= this.settings.lapCount ) {

					e.finishedAt = this.elapsed;
					e.totalTime = this.elapsed;
					this.finishOrder.push( e );
					if ( e.isPlayer ) this.playerFinishedAt = this.elapsed;

				}

			}

			const allFinished = this.entries.every( e => e.finishedAt !== null );
			const playerTimedOut = this.playerFinishedAt !== null && ( this.elapsed - this.playerFinishedAt ) > POST_PLAYER_TIMEOUT;

			if ( allFinished || playerTimedOut ) {

				// Add any unfinished cars to the order, sorted by lap progress.
				const unfinished = this.entries.filter( e => e.finishedAt === null );
				unfinished.sort( ( a, b ) => this.compareProgress( a, b ) );
				for ( const e of unfinished ) this.finishOrder.push( e );
				this.state = 'finished';

			}

		}

	}

	compareProgress( a, b ) {

		const al = a.lapTracker.lapsCompleted;
		const bl = b.lapTracker.lapsCompleted;
		if ( al !== bl ) return bl - al;
		const ai = nearestWaypointIndex( this.waypoints.points, a.vehicle.spherePos, a.lastWpIdx );
		const bi = nearestWaypointIndex( this.waypoints.points, b.vehicle.spherePos, b.lastWpIdx );
		return bi - ai;

	}

	livePositions() {

		// Returns entries sorted by current race position (1st first).
		// Finished cars rank by finish time. Unfinished cars rank by lap+progress.
		const finished = this.entries.filter( e => e.finishedAt !== null );
		const unfinished = this.entries.filter( e => e.finishedAt === null );

		finished.sort( ( a, b ) => a.finishedAt - b.finishedAt );

		// Update cached lastWpIdx and sort.
		for ( const e of unfinished ) {

			e.lastWpIdx = nearestWaypointIndex( this.waypoints.points, e.vehicle.spherePos, e.lastWpIdx );

		}
		unfinished.sort( ( a, b ) => this.compareProgress( a, b ) );

		return [ ...finished, ...unfinished ];

	}

	hudPayload() {

		const positions = this.livePositions();
		const playerPos = positions.indexOf( this.player ) + 1;
		const lap = Math.min( this.settings.lapCount, this.player.lapTracker.lapsCompleted + 1 );

		return {
			state: this.state,
			countdownRemaining: this.countdownRemaining,
			position: playerPos,
			totalCars: this.entries.length,
			lap,
			totalLaps: this.settings.lapCount,
			currentLapTime: this.player.lapTracker.currentLapTime,
			lastLap: this.player.lapTracker.lastLapTime,
			bestLap: this.player.lapTracker.bestLapTime,
			finishOrder: this.state === 'finished' ? this.finishOrder.map( e => ( {
				name: e.colorName,
				colorKey: e.colorKey,
				isPlayer: e.isPlayer,
				totalTime: e.totalTime,
				bestLap: e.lapTracker.bestLapTime,
				lapsCompleted: e.lapTracker.lapsCompleted,
				finished: e.finishedAt !== null,
			} ) ) : null,
		};

	}

}
