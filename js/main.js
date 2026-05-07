import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { LightProbeGrid } from 'three/addons/lighting/LightProbeGrid.js';
import { LightProbeGridHelper } from 'three/addons/helpers/LightProbeGridHelper.js';
import { createWorldSettings, createWorld, addBroadphaseLayer, addObjectLayer, enableCollision, registerAll, updateWorld, rigidBody, box, MotionType } from 'crashcat';
import { MAX_SPEED } from './Vehicle.js';
import { Camera } from './Camera.js';
import { Controls } from './Controls.js';
import { buildTrack, decodeCells, computeSpawnPosition, computeTrackBounds } from './Track.js';
import { buildWallColliders } from './Physics.js';
import { SmokeTrails } from './Particles.js';
import { DriftMarks } from './DriftMarks.js';
import { GameAudio } from './Audio.js';
import { ColorMapGLTFLoader } from './Loader.js';
import { buildWaypoints, buildWaypointDebug } from './Waypoints.js';
import { Race } from './Race.js';
import { RaceUI } from './RaceUI.js';


const renderer = new THREE.WebGLRenderer( { antialias: true, outputBufferType: THREE.HalfFloatType } );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setPixelRatio( window.devicePixelRatio );
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ) );
bloomPass.strength = 0.02;
bloomPass.radius = 0.02;
bloomPass.threshold = 0.5;

renderer.setEffects( [ bloomPass ] );

document.body.appendChild( renderer.domElement );

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0xadb2ba );
scene.fog = new THREE.Fog( 0xadb2ba, 30, 55 );

const dirLight = new THREE.DirectionalLight( 0xffffff, 3 );
dirLight.position.set( 11.4, 15, -5.3 );
dirLight.castShadow = true;
dirLight.shadow.mapSize.setScalar( 4096 );
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 60;
dirLight.shadow.radius = 4;
scene.add( dirLight );

const hemiLight = new THREE.HemisphereLight( 0xc8d8e8, 0x7a8a5a, 2 );
hemiLight.position.copy( dirLight.position )
scene.add( hemiLight );


window.addEventListener( 'resize', () => {

	renderer.setSize( window.innerWidth, window.innerHeight );

} );

const loader = new ColorMapGLTFLoader();

const modelNames = [
	'vehicle-truck-yellow', 'vehicle-truck-green', 'vehicle-truck-purple', 'vehicle-truck-red',
	'track-straight', 'track-corner', 'track-bump', 'track-finish',
	'decoration-empty', 'decoration-forest', 'decoration-tents',
];

const models = {};

async function loadModels() {

	const promises = modelNames.map( ( name ) =>
		new Promise( ( resolve, reject ) => {

			loader.load( `models/${ name }.glb`, ( gltf ) => {

				const meshes = [];
				gltf.scene.traverse( ( child ) => {

					if ( child.isMesh ) {

						child.material.side = THREE.FrontSide;
						meshes.push( child );

					}

				} );

				// Godot imports vehicle models at root_scale=0.5
				if ( name.startsWith( 'vehicle-' ) ) {

					gltf.scene.scale.setScalar( 0.5 );

				}

				if ( meshes.length === 1 ) {

					const mesh = meshes[ 0 ];
					mesh.removeFromParent();
					models[ name ] = mesh;

				} else {

					models[ name ] = gltf.scene;

				}

				resolve();

			}, undefined, reject );

		} )
	);

	await Promise.all( promises );

}

async function init() {

	registerAll();
	await loadModels();

	const params = new URLSearchParams( window.location.search );
	const mapParam = params.get( 'map' );
	let customCells = null;

	if ( mapParam ) {

		try {

			customCells = decodeCells( mapParam );

		} catch ( e ) {

			console.warn( 'Invalid map parameter, using default track' );

		}

	}

	// Compute track bounds and size physics/shadows to fit
	const bounds = computeTrackBounds( customCells );
	const hw = bounds.halfWidth;
	const hd = bounds.halfDepth;
	const groundSize = Math.max( hw, hd ) * 2 + 20;

	const shadowExtent = Math.max( hw, hd ) + 10;
	dirLight.shadow.camera.left = - shadowExtent;
	dirLight.shadow.camera.right = shadowExtent;
	dirLight.shadow.camera.top = shadowExtent;
	dirLight.shadow.camera.bottom = - shadowExtent;
	dirLight.shadow.camera.updateProjectionMatrix();

	scene.fog.near = groundSize * 0.4;
	scene.fog.far = groundSize * 0.8;

	buildTrack( scene, models, customCells, { excludeNpcTrucks: true } );

	const debugFlag = params.get( 'debug' );
	if ( debugFlag && debugFlag.includes( 'waypoints' ) ) {

		const wp = buildWaypoints( customCells );
		if ( wp ) scene.add( buildWaypointDebug( wp ) );
		else console.warn( 'buildWaypoints returned null — track has no closed loop with finish' );

	}

	// Probes

	const probeHeight = 6;
	const probes = new LightProbeGrid(
		hw * 2, probeHeight, hd * 2,
		Math.max( 4, Math.round( hw / 4 ) ),
		2,
		Math.max( 4, Math.round( hd / 4 ) ),
	);
	probes.position.set( bounds.centerX, probeHeight / 2, bounds.centerZ );
	probes.bake( renderer, scene, { cubemapSize: 32, near: 0.1, far: groundSize } );
	scene.add( probes );

	//

	const worldSettings = createWorldSettings();
	worldSettings.gravity = [ 0, - 9.81, 0 ];

	const BPL_MOVING = addBroadphaseLayer( worldSettings );
	const BPL_STATIC = addBroadphaseLayer( worldSettings );
	const OL_MOVING = addObjectLayer( worldSettings, BPL_MOVING );
	const OL_STATIC = addObjectLayer( worldSettings, BPL_STATIC );

	enableCollision( worldSettings, OL_MOVING, OL_STATIC );
	enableCollision( worldSettings, OL_MOVING, OL_MOVING );

	const world = createWorld( worldSettings );
	world._OL_MOVING = OL_MOVING;
	world._OL_STATIC = OL_STATIC;

	buildWallColliders( world, null, customCells );

	const roadHalf = groundSize / 2;
	rigidBody.create( world, {
		shape: box.create( { halfExtents: [ roadHalf, 0.01, roadHalf ] } ),
		motionType: MotionType.STATIC,
		objectLayer: OL_STATIC,
		position: [ bounds.centerX, - 0.125, bounds.centerZ ],
		friction: 5.0,
		restitution: 0.0,
	} );

	const cam = new Camera();
	scene.add( cam.debug );

	const controls = new Controls();

	const particles = new SmokeTrails( scene );
	const driftMarks = new DriftMarks( scene, mapParam );

	const audio = new GameAudio();
	audio.init( cam.camera );

	const raceUI = new RaceUI();

	const _forward = new THREE.Vector3();
	const _camLead = new THREE.Vector3();

	let race = null;
	let contactListener = null;

	function startRace( settings ) {

		console.log( '[Race] starting with', settings );

		// Tear down any prior race state.
		if ( race ) tearDownRace( race );

		try {
			race = new Race( { scene, world, models, cells: customCells, settings } );
		} catch ( e ) {
			console.error( '[Race] failed to construct:', e );
			throw e;
		}

		console.log( '[Race] entries:', race.entries.length, 'state:', race.state );

		const playerBody = race.player.body;

		contactListener = {
			onContactAdded( bodyA, bodyB ) {

				if ( bodyA !== playerBody && bodyB !== playerBody ) return;

				_forward.set( 0, 0, 1 ).applyQuaternion( race.player.vehicle.container.quaternion );
				_forward.y = 0;
				_forward.normalize();

				const impactVelocity = Math.abs( race.player.vehicle.modelVelocity.dot( _forward ) );
				audio.playImpact( impactVelocity );

			}
		};

		dirLight.target = race.player.group;

		const editorLink = document.getElementById( 'editor-link' );
		if ( editorLink ) editorLink.style.display = '';

	}

	function tearDownRace( r ) {

		for ( const e of r.entries ) {

			scene.remove( e.group );
			rigidBody.remove( world, e.body );

		}

	}

	const editorLink = document.getElementById( 'editor-link' );
	if ( editorLink ) editorLink.style.display = 'none';

	const initialSettings = await raceUI.showSetup();
	startRace( initialSettings );

	const timer = new THREE.Timer();
	let resultsShown = false;

	function animate() {

		requestAnimationFrame( animate );

		timer.update();
		const dt = Math.min( timer.getDelta(), 1 / 30 );

		const input = controls.update();

		updateWorld( world, contactListener, dt );

		race.tick( dt, input );

		const player = race.player.vehicle;

		dirLight.position.set(
			player.spherePos.x + 11.4,
			15,
			player.spherePos.z - 5.3
		);

		const mv = player.modelVelocity;
		_camLead.set( 0, 0, 1 ).applyQuaternion( player.container.quaternion ).multiplyScalar( Math.sqrt( mv.x * mv.x + mv.z * mv.z ) );
		cam.update( dt, player.spherePos, _camLead );
		particles.update( dt, player );
		driftMarks.update( dt, player );
		audio.update( dt, player.linearSpeed / MAX_SPEED, input.z, player.driftIntensity );

		const hud = race.hudPayload();

		if ( race.state === 'countdown' ) {

			raceUI.showCountdown( race.countdownRemaining );

		} else if ( race.state === 'racing' ) {

			raceUI.hideCountdown();
			raceUI.updateHUD( hud );

		} else if ( race.state === 'finished' && ! resultsShown ) {

			resultsShown = true;
			raceUI.hideHUD();
			raceUI.hideCountdown();
			raceUI.showResults( hud, {
				onRaceAgain: async () => {

					resultsShown = false;
					if ( editorLink ) editorLink.style.display = 'none';
					const next = await raceUI.showSetup();
					startRace( next );

				},
				onEditTrack: () => {

					const url = mapParam ? `editor.html?map=${ mapParam }` : 'editor.html';
					window.location.href = url;

				},
			} );

		}

		renderer.render( scene, cam.camera );

	}

	animate();

}

init();
