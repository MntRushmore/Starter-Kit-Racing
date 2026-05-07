import * as THREE from 'three';
import { CELL_RAW, GRID_SCALE, ORIENT_DEG, TRACK_CELLS, TYPE_NAMES } from './Track.js';

const FINISH = TYPE_NAMES[ 3 ];
const TRACK_TYPES = new Set( TYPE_NAMES );

const CELL_WORLD = CELL_RAW * GRID_SCALE;

function cellCenter( gx, gz ) {

	return new THREE.Vector3( ( gx + 0.5 ) * CELL_WORLD, 0.5, ( gz + 0.5 ) * CELL_WORLD );

}

function neighbors( map, gx, gz ) {

	const out = [];
	const candidates = [ [ gx + 1, gz ], [ gx - 1, gz ], [ gx, gz + 1 ], [ gx, gz - 1 ] ];
	for ( const [ nx, nz ] of candidates ) {

		if ( map.has( nx + ',' + nz ) ) out.push( [ nx, nz ] );

	}
	return out;

}

// Build an ordered list of waypoints (Vector3) walking the track loop from the
// finish line forward. Returns null if the track has no finish or doesn't form
// a connected loop. Each track cell contributes one waypoint at its center.
export function buildWaypoints( cells ) {

	const list = cells || TRACK_CELLS;

	const map = new Map();
	let finishCell = null;

	for ( const c of list ) {

		const [ gx, gz, key ] = c;
		if ( ! TRACK_TYPES.has( key ) ) continue;
		map.set( gx + ',' + gz, c );
		if ( key === FINISH ) finishCell = c;

	}

	if ( ! finishCell ) return null;

	// Forward direction from finish cell orientation. Local +Z is forward;
	// rotating (0, 1) by orientation gives the (Δgx, Δgz) of the next cell.
	const orient = finishCell[ 3 ];
	const deg = ORIENT_DEG[ orient ] ?? 0;
	const rad = deg * Math.PI / 180;
	const fdx = Math.round( Math.sin( rad ) );
	const fdz = Math.round( Math.cos( rad ) );

	const finishKey = finishCell[ 0 ] + ',' + finishCell[ 1 ];
	const startNext = [ finishCell[ 0 ] + fdx, finishCell[ 1 ] + fdz ];
	if ( ! map.has( startNext[ 0 ] + ',' + startNext[ 1 ] ) ) return null;

	const points = [ cellCenter( finishCell[ 0 ], finishCell[ 1 ] ) ];
	const finishIndex = 0;

	let prev = [ finishCell[ 0 ], finishCell[ 1 ] ];
	let cur = startNext;
	let safety = list.length + 4;

	while ( safety-- > 0 ) {

		points.push( cellCenter( cur[ 0 ], cur[ 1 ] ) );

		const nbrs = neighbors( map, cur[ 0 ], cur[ 1 ] );
		// Pick the neighbor that isn't `prev`. Tracks have exactly two
		// connections per cell; if more (junction), prefer one that hasn't
		// been visited.
		let next = null;
		for ( const n of nbrs ) {

			if ( n[ 0 ] === prev[ 0 ] && n[ 1 ] === prev[ 1 ] ) continue;
			next = n;
			break;

		}

		if ( ! next ) return null;
		if ( next[ 0 ] === finishCell[ 0 ] && next[ 1 ] === finishCell[ 1 ] ) break;

		prev = cur;
		cur = next;

	}

	if ( safety <= 0 ) return null;

	let lapDistance = 0;
	for ( let i = 0; i < points.length; i ++ ) {

		const a = points[ i ];
		const b = points[ ( i + 1 ) % points.length ];
		lapDistance += a.distanceTo( b );

	}

	return { points, finishIndex, lapDistance };

}

// Find the closest waypoint to `pos`, searching a small window around `lastIdx`
// to keep this O(1) per frame and robust to weird trajectories.
export function nearestWaypointIndex( points, pos, lastIdx, windowSize = 6 ) {

	const n = points.length;
	if ( n === 0 ) return 0;

	let bestIdx = lastIdx;
	let bestDist = Infinity;

	for ( let off = -1; off <= windowSize; off ++ ) {

		const idx = ( ( lastIdx + off ) % n + n ) % n;
		const d = points[ idx ].distanceToSquared( pos );
		if ( d < bestDist ) {

			bestDist = d;
			bestIdx = idx;

		}

	}

	return bestIdx;

}

// Build a debug Line showing the racing-line loop. Useful for verifying
// waypoint generation on default + custom tracks.
export function buildWaypointDebug( waypoints ) {

	const pts = [];
	for ( const p of waypoints.points ) pts.push( p.x, 0.6, p.z );
	pts.push( waypoints.points[ 0 ].x, 0.6, waypoints.points[ 0 ].z );

	const geo = new THREE.BufferGeometry();
	geo.setAttribute( 'position', new THREE.Float32BufferAttribute( pts, 3 ) );

	const lineMat = new THREE.LineBasicMaterial( { color: 0xff5588 } );
	const line = new THREE.Line( geo, lineMat );

	const sphereGeo = new THREE.SphereGeometry( 0.18, 8, 6 );
	const sphereMat = new THREE.MeshBasicMaterial( { color: 0xffcc33 } );
	const group = new THREE.Group();
	group.add( line );

	for ( let i = 0; i < waypoints.points.length; i ++ ) {

		const m = new THREE.Mesh( sphereGeo, sphereMat );
		m.position.copy( waypoints.points[ i ] );
		m.position.y = 0.6;
		group.add( m );

	}

	return group;

}
