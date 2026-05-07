import * as THREE from 'three';
import { CELL_RAW, GRID_SCALE, TRACK_CELLS, TYPE_NAMES, computeSpawnPosition } from './Track.js';

const FINISH = TYPE_NAMES[ 3 ];
const _tmp = new THREE.Vector3();

// Per-vehicle lap counting. No DOM, no localStorage — pure engine. Fires
// 'crossed' events when a vehicle crosses the finish line after visiting all
// non-finish track cells on the current lap.
export class LapTracker {

	constructor( cells ) {

		this.lineCenter = new THREE.Vector3();
		this.lineForward = new THREE.Vector3( 0, 0, 1 );
		this.lineRight = new THREE.Vector3( 1, 0, 0 );

		this.prevForwardProj = null;

		this.cellSize = CELL_RAW * GRID_SCALE;
		this.requiredCells = new Set();
		this.visitedCells = new Set();

		this.lapsCompleted = 0;
		this.currentLapTime = 0;
		this.lastLapTime = null;
		this.bestLapTime = null;
		this.running = false;

		const list = cells || TRACK_CELLS;
		this.enabled = list.some( ( c ) => c[ 2 ] === FINISH );

		if ( this.enabled ) {

			const spawn = computeSpawnPosition( list );
			this.lineCenter.set( spawn.position[ 0 ], 0, spawn.position[ 2 ] );
			this.lineForward.set( Math.sin( spawn.angle ), 0, Math.cos( spawn.angle ) );
			this.lineRight.set( this.lineForward.z, 0, - this.lineForward.x );

			for ( const c of list ) {

				if ( c[ 2 ] !== FINISH ) this.requiredCells.add( c[ 0 ] + ',' + c[ 1 ] );

			}

		}

	}

	start() {

		this.running = true;

	}

	// Returns null normally, or { type: 'crossed', lapTime } when the finish
	// line is crossed after visiting every required cell.
	update( dt, position ) {

		if ( ! this.enabled || ! this.running ) return null;

		this.currentLapTime += dt;

		const gx = Math.floor( position.x / this.cellSize );
		const gz = Math.floor( position.z / this.cellSize );
		const key = gx + ',' + gz;
		if ( this.requiredCells.has( key ) ) this.visitedCells.add( key );

		_tmp.copy( position ).sub( this.lineCenter );
		const forwardProj = _tmp.dot( this.lineForward );
		const lateralProj = Math.abs( _tmp.dot( this.lineRight ) );

		let event = null;

		if ( this.prevForwardProj !== null ) {

			const onLine = lateralProj <= this.cellSize * 0.5;
			const noTeleport = Math.abs( forwardProj - this.prevForwardProj ) < 5;
			const crossedForward = this.prevForwardProj < 0 && forwardProj >= 0;

			if ( onLine && noTeleport && crossedForward && this.visitedCells.size === this.requiredCells.size ) {

				const lapTime = this.currentLapTime;
				this.lastLapTime = lapTime;
				if ( this.bestLapTime === null || lapTime < this.bestLapTime ) this.bestLapTime = lapTime;
				this.lapsCompleted += 1;
				this.currentLapTime = 0;
				this.visitedCells.clear();

				event = { type: 'crossed', lapTime, lapIndex: this.lapsCompleted };

			} else if ( onLine && noTeleport && crossedForward ) {

				// Crossed line without visiting all cells — shortcut. Reset the
				// visited set so they have to do the full lap from here.
				this.visitedCells.clear();

			}

		}

		this.prevForwardProj = forwardProj;

		return event;

	}

}
