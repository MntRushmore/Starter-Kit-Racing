import { COLOR_KEYS } from './Race.js';

const SETUP_KEY = 'racing.raceSetup';

const SWATCH = {
	'vehicle-truck-yellow': '#ffc833',
	'vehicle-truck-red':    '#e94f4f',
	'vehicle-truck-green':  '#5fcb5f',
	'vehicle-truck-purple': '#a874e0',
};

const SWATCH_SHADOW = {
	'vehicle-truck-yellow': '#d99e1a',
	'vehicle-truck-red':    '#a83333',
	'vehicle-truck-green':  '#3e9a3e',
	'vehicle-truck-purple': '#7250a8',
};

function formatTime( t ) {

	if ( t === null || t === undefined ) return '—';
	const m = Math.floor( t / 60 );
	const s = t - m * 60;
	return `${ m }:${ s.toFixed( 2 ).padStart( 5, '0' ) }`;

}

function loadSetup() {

	try {

		const v = localStorage.getItem( SETUP_KEY );
		if ( ! v ) return null;
		return JSON.parse( v );

	} catch { return null; }

}

function saveSetup( s ) {

	try { localStorage.setItem( SETUP_KEY, JSON.stringify( s ) ); } catch {}

}

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Bowlby+One+SC&family=Fredoka:wght@500;600;700&display=swap');

#race-overlay {
	position: absolute; inset: 0; z-index: 20;
	display: flex; align-items: center; justify-content: center;
	font: 600 15px 'Fredoka', -apple-system, BlinkMacSystemFont, sans-serif;
	color: #2a2018;
	pointer-events: none;
}
#race-overlay.modal-open {
	background: rgba(20, 24, 32, 0.35);
	pointer-events: auto;
	backdrop-filter: blur(6px) saturate(1.1); -webkit-backdrop-filter: blur(6px) saturate(1.1);
}

.race-card {
	background: #fff8e7;
	border: 4px solid #2a2018;
	padding: 26px 30px 28px;
	border-radius: 22px;
	min-width: 360px; max-width: 440px;
	box-shadow: 0 8px 0 #2a2018, 0 16px 32px rgba(0,0,0,0.35);
	pointer-events: auto;
	position: relative;
}

.race-card::before {
	content: '';
	position: absolute; top: -4px; left: 30px; right: 30px; height: 14px;
	background: repeating-linear-gradient(45deg, #2a2018 0 10px, #fff8e7 10px 20px);
	border-radius: 0 0 6px 6px;
	border: 4px solid #2a2018; border-top: none;
	pointer-events: none;
}

.race-card h1 {
	margin: 12px 0 4px;
	font: 400 32px/1 'Bowlby One SC', sans-serif;
	letter-spacing: 0.02em;
	color: #2a2018;
	text-shadow: 0 3px 0 #ffc833;
}
.race-card .sub {
	font-size: 14px; font-weight: 500;
	margin-bottom: 22px;
	color: #6b5b4a;
}

.race-card label.field-label {
	display: block;
	font: 700 11px/1 'Fredoka', sans-serif;
	letter-spacing: 0.14em;
	text-transform: uppercase;
	color: #2a2018;
	margin: 16px 0 8px;
}

.race-card .row { display: flex; gap: 8px; }
.race-card .pill {
	flex: 1;
	padding: 11px 8px;
	border: 3px solid #2a2018;
	border-radius: 12px;
	background: #fff;
	color: #2a2018;
	cursor: pointer;
	text-align: center;
	user-select: none;
	font: 700 14px/1 'Fredoka', sans-serif;
	letter-spacing: 0.04em;
	box-shadow: 0 4px 0 #2a2018;
	transition: transform 0.08s, box-shadow 0.08s, background 0.12s;
}
.race-card .pill:hover { background: #fff3cf; }
.race-card .pill:active { transform: translateY(2px); box-shadow: 0 2px 0 #2a2018; }
.race-card .pill.active {
	background: #ffc833;
	transform: translateY(2px);
	box-shadow: 0 2px 0 #2a2018;
}

.race-card .swatch-row { display: flex; gap: 12px; padding: 6px 0 2px; }
.race-card .swatch {
	width: 52px; height: 52px;
	border-radius: 50%;
	border: 4px solid #2a2018;
	cursor: pointer;
	box-shadow: 0 4px 0 #2a2018;
	transition: transform 0.1s, box-shadow 0.1s;
}
.race-card .swatch:hover { transform: translateY(-2px); box-shadow: 0 6px 0 #2a2018; }
.race-card .swatch.active {
	transform: translateY(2px);
	box-shadow: 0 2px 0 #2a2018, inset 0 0 0 4px #fff8e7;
}

.race-card .start {
	display: block; width: 100%;
	margin-top: 26px; padding: 16px;
	border: 4px solid #2a2018;
	border-radius: 14px;
	cursor: pointer;
	background: #5fcb5f;
	color: #1a3320;
	font: 400 22px/1 'Bowlby One SC', sans-serif;
	letter-spacing: 0.06em;
	box-shadow: 0 6px 0 #2a2018;
	transition: transform 0.08s, box-shadow 0.08s;
}
.race-card .start:hover { background: #6fdb6f; }
.race-card .start:active { transform: translateY(3px); box-shadow: 0 3px 0 #2a2018; }

#race-countdown {
	font: 400 180px/1 'Bowlby One SC', sans-serif;
	color: #fff;
	-webkit-text-stroke: 6px #2a2018;
	text-stroke: 6px #2a2018;
	text-shadow:
		0 8px 0 #2a2018,
		0 16px 40px rgba(0,0,0,0.5);
	letter-spacing: -0.01em;
	user-select: none; pointer-events: none;
}
#race-countdown.go {
	color: #5fcb5f;
	font-size: 220px;
}

#race-finish-banner {
	position: absolute; top: 30%; left: 50%;
	transform: translate(-50%, -50%);
	font: 400 110px/1 'Bowlby One SC', sans-serif;
	color: #ffc833;
	-webkit-text-stroke: 6px #2a2018;
	text-shadow: 0 8px 0 #2a2018, 0 16px 32px rgba(0,0,0,0.4);
	letter-spacing: 0.04em;
	pointer-events: none;
	animation: finish-slam 0.6s cubic-bezier(0.2, 0.9, 0.3, 1.4);
}
#race-finish-banner.lose { color: #fff; }

@keyframes finish-slam {
	0%   { transform: translate(-50%, -50%) scale(0.2) rotate(-10deg); opacity: 0; }
	50%  { transform: translate(-50%, -50%) scale(1.15) rotate(3deg); opacity: 1; }
	100% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; }
}

@keyframes shake {
	0%, 100% { transform: translate(0, 0); }
	10% { transform: translate(-6px, 4px); }
	20% { transform: translate(7px, -3px); }
	30% { transform: translate(-5px, -5px); }
	40% { transform: translate(6px, 6px); }
	50% { transform: translate(-7px, 2px); }
	60% { transform: translate(5px, -4px); }
	70% { transform: translate(-4px, 5px); }
	80% { transform: translate(6px, -2px); }
	90% { transform: translate(-3px, 3px); }
}
canvas.shake { animation: shake 0.45s ease-out; }

.confetti-piece {
	position: absolute; width: 10px; height: 16px;
	pointer-events: none; will-change: transform;
}

#race-hud {
	position: absolute; top: 16px; left: 16px;
	background: #fff8e7;
	border: 4px solid #2a2018;
	border-radius: 18px;
	padding: 14px 18px;
	font-family: 'Fredoka', sans-serif;
	min-width: 200px; line-height: 1.3;
	box-shadow: 0 6px 0 #2a2018;
	user-select: none; pointer-events: none;
	color: #2a2018;
}
#race-hud .pos {
	display: flex; align-items: baseline; gap: 4px;
	font: 400 42px/1 'Bowlby One SC', sans-serif;
	color: #2a2018;
	text-shadow: 0 3px 0 #ffc833;
}
#race-hud .pos .total {
	font: 700 18px 'Fredoka', sans-serif;
	color: #6b5b4a; text-shadow: none;
	letter-spacing: 0.04em;
}
#race-hud .label {
	font: 700 10px 'Fredoka', sans-serif;
	letter-spacing: 0.14em; text-transform: uppercase;
	color: #6b5b4a;
}
#race-hud .lap-line {
	display: flex; justify-content: space-between; gap: 14px;
	margin-top: 10px; padding-top: 10px;
	border-top: 3px dashed #d4c5a8;
}
#race-hud .lap-num { font: 700 18px 'Fredoka', sans-serif; }
#race-hud .timer {
	font: 700 22px 'Fredoka', sans-serif;
	font-variant-numeric: tabular-nums;
	color: #2a2018;
}
#race-hud .stat-row {
	display: flex; justify-content: space-between;
	font: 600 13px 'Fredoka', sans-serif;
	font-variant-numeric: tabular-nums;
	margin-top: 4px;
}

.results-card { min-width: 420px; }
.results-card .winner-banner {
	font: 400 28px/1.1 'Bowlby One SC', sans-serif;
	color: #2a2018;
	text-shadow: 0 3px 0 #ffc833;
	margin: 14px 0 6px;
}
.results-row {
	display: grid;
	grid-template-columns: 36px 32px 1fr 86px 86px;
	gap: 10px; align-items: center;
	padding: 10px 4px;
	border-bottom: 2px dashed #d4c5a8;
	font-variant-numeric: tabular-nums;
}
.results-row:last-child { border-bottom: none; }
.results-row .pos-cell {
	font: 400 24px/1 'Bowlby One SC', sans-serif;
	color: #2a2018;
}
.results-row.first .pos-cell { color: #ffc833; text-shadow: 0 2px 0 #2a2018; }
.results-row.second .pos-cell { color: #c0c0c0; text-shadow: 0 2px 0 #2a2018; }
.results-row.third .pos-cell { color: #cd7f32; text-shadow: 0 2px 0 #2a2018; }
.results-row .swatch-cell {
	width: 28px; height: 28px; border-radius: 50%;
	border: 3px solid #2a2018;
}
.results-row .name-cell {
	font: 700 15px 'Fredoka', sans-serif;
	color: #2a2018;
}
.results-row .name-cell.you { color: #2a8c3a; }
.results-row .time-cell {
	font: 700 14px 'Fredoka', sans-serif;
	color: #2a2018;
	text-align: right;
}
.results-row .label-cell {
	font: 700 9px 'Fredoka', sans-serif;
	letter-spacing: 0.12em; text-transform: uppercase;
	color: #6b5b4a;
	text-align: right;
}
.results-card .button-row { display: flex; gap: 10px; margin-top: 22px; }
.results-card .button-row > * {
	flex: 1; padding: 14px;
	border: 4px solid #2a2018; border-radius: 12px;
	cursor: pointer; text-align: center;
	font: 400 16px/1 'Bowlby One SC', sans-serif;
	letter-spacing: 0.04em;
	box-shadow: 0 5px 0 #2a2018;
	transition: transform 0.08s, box-shadow 0.08s;
}
.results-card .button-row > *:active { transform: translateY(3px); box-shadow: 0 2px 0 #2a2018; }
.results-card .secondary { background: #fff; color: #2a2018; }
.results-card .secondary:hover { background: #fff3cf; }
.results-card .primary { background: #ffc833; color: #2a2018; }
.results-card .primary:hover { background: #ffd757; }

@keyframes count-pop {
	0%   { transform: scale(0.3) rotate(-8deg); opacity: 0; }
	40%  { transform: scale(1.15) rotate(2deg); opacity: 1; }
	70%  { transform: scale(0.95) rotate(-1deg); }
	100% { transform: scale(1) rotate(0); opacity: 1; }
}
#race-countdown.pulse { animation: count-pop 0.55s cubic-bezier(0.2, 0.9, 0.3, 1.4); }

@keyframes card-in {
	from { transform: translateY(40px) scale(0.92); opacity: 0; }
	to   { transform: translateY(0) scale(1); opacity: 1; }
}
.race-card { animation: card-in 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.2); }
`;

export class RaceUI {

	constructor() {

		const style = document.createElement( 'style' );
		style.textContent = STYLE;
		document.head.appendChild( style );

		this.overlay = document.createElement( 'div' );
		this.overlay.id = 'race-overlay';
		document.body.appendChild( this.overlay );

		this.hud = null;
		this.countdownEl = null;
		this.lastCountdownInt = null;

	}

	showSetup() {

		const saved = loadSetup() || {};
		const settings = {
			lapCount: saved.lapCount ?? 3,
			aiCount: saved.aiCount ?? 2,
			difficulty: saved.difficulty || 'medium',
			playerColor: saved.playerColor || COLOR_KEYS[ 0 ].key,
		};

		return new Promise( ( resolve ) => {

			this.overlay.classList.add( 'modal-open' );

			const card = document.createElement( 'div' );
			card.className = 'race-card';
			card.innerHTML = `
				<h1>Race Setup</h1>
				<div class="sub">Pick your loadout and let's go!</div>

				<label class="field-label">Laps</label>
				<div class="row" data-field="lapCount">
					${ [ 3, 5, 10 ].map( n => `<div class="pill" data-value="${ n }">${ n }</div>` ).join( '' ) }
				</div>

				<label class="field-label">Opponents</label>
				<div class="row" data-field="aiCount">
					${ [ 1, 2, 3 ].map( n => `<div class="pill" data-value="${ n }">${ n }</div>` ).join( '' ) }
				</div>

				<label class="field-label">Difficulty</label>
				<div class="row" data-field="difficulty">
					${ [ 'easy', 'medium', 'hard' ].map( d => `<div class="pill" data-value="${ d }">${ d.toUpperCase() }</div>` ).join( '' ) }
				</div>

				<label class="field-label">Your Truck</label>
				<div class="swatch-row" data-field="playerColor">
					${ COLOR_KEYS.map( c => `<div class="swatch" data-value="${ c.key }" style="background:${ SWATCH[ c.key ] }"></div>` ).join( '' ) }
				</div>

				<button class="start">Start Race!</button>
			`;

			this.overlay.appendChild( card );

			const refresh = () => {

				for ( const group of card.querySelectorAll( '[data-field]' ) ) {

					const field = group.dataset.field;
					const current = String( settings[ field ] );
					for ( const opt of group.children ) {

						opt.classList.toggle( 'active', opt.dataset.value === current );

					}

				}

			};

			card.addEventListener( 'click', ( e ) => {

				const opt = e.target.closest( '[data-value]' );
				if ( ! opt ) return;
				const field = opt.parentElement.dataset.field;
				let val = opt.dataset.value;
				if ( field === 'lapCount' || field === 'aiCount' ) val = parseInt( val, 10 );
				settings[ field ] = val;
				refresh();

			} );

			card.querySelector( '.start' ).addEventListener( 'click', () => {

				saveSetup( settings );
				this.overlay.classList.remove( 'modal-open' );
				this.overlay.removeChild( card );
				resolve( settings );

			} );

			refresh();

		} );

	}

	showCountdown( secondsRemaining ) {

		if ( ! this.countdownEl ) {

			this.countdownEl = document.createElement( 'div' );
			this.countdownEl.id = 'race-countdown';
			this.overlay.appendChild( this.countdownEl );

		}

		let label;
		if ( secondsRemaining > 2.5 ) label = '3';
		else if ( secondsRemaining > 1.5 ) label = '2';
		else if ( secondsRemaining > 0.5 ) label = '1';
		else label = 'GO!';

		if ( label !== this.lastCountdownInt ) {

			this.countdownEl.textContent = label;
			this.countdownEl.classList.toggle( 'go', label === 'GO!' );
			this.countdownEl.classList.remove( 'pulse' );
			void this.countdownEl.offsetWidth;
			this.countdownEl.classList.add( 'pulse' );
			this.lastCountdownInt = label;

		}

	}

	hideCountdown() {

		if ( this.countdownEl ) {

			this.countdownEl.remove();
			this.countdownEl = null;
			this.lastCountdownInt = null;

		}

	}

	shakeScreen() {

		const canvas = document.querySelector( 'canvas' );
		if ( ! canvas ) return;
		canvas.classList.remove( 'shake' );
		void canvas.offsetWidth;
		canvas.classList.add( 'shake' );

	}

	showFinishBanner( won ) {

		const el = document.createElement( 'div' );
		el.id = 'race-finish-banner';
		el.textContent = won ? 'FINISH!' : 'FINISH';
		if ( ! won ) el.classList.add( 'lose' );
		document.body.appendChild( el );
		setTimeout( () => el.remove(), 2200 );

	}

	burstConfetti( count = 80 ) {

		const colors = [ '#ffc833', '#e94f4f', '#5fcb5f', '#a874e0', '#5da4f0', '#ff8a3d' ];
		const root = document.body;

		for ( let i = 0; i < count; i ++ ) {

			const p = document.createElement( 'div' );
			p.className = 'confetti-piece';
			p.style.background = colors[ i % colors.length ];
			p.style.left = ( 30 + Math.random() * 40 ) + '%';
			p.style.top = '40%';
			p.style.transform = `rotate(${ Math.random() * 360 }deg)`;
			root.appendChild( p );

			const dx = ( Math.random() - 0.5 ) * 800;
			const dy = window.innerHeight - 100;
			const rot = ( Math.random() - 0.5 ) * 720;
			const dur = 1400 + Math.random() * 1200;

			p.animate(
				[
					{ transform: `translate(0, 0) rotate(0deg)`, opacity: 1 },
					{ transform: `translate(${ dx }px, ${ dy }px) rotate(${ rot }deg)`, opacity: 0 }
				],
				{ duration: dur, easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)', fill: 'forwards' }
			);

			setTimeout( () => p.remove(), dur );

		}

	}

	ensureHUD() {

		if ( this.hud ) return;

		this.hud = document.createElement( 'div' );
		this.hud.id = 'race-hud';
		this.hud.innerHTML = `
			<div class="label">Position</div>
			<div class="pos"><span class="pos-num">1</span><span class="total">/ 4</span></div>
			<div class="lap-line">
				<div>
					<div class="label">Lap</div>
					<div class="lap-num">1 / 3</div>
				</div>
				<div style="text-align:right">
					<div class="label">Current</div>
					<div class="timer">0:00.00</div>
				</div>
			</div>
			<div class="stat-row"><span class="label">Last</span><span class="last">—</span></div>
			<div class="stat-row"><span class="label">Best</span><span class="best">—</span></div>
		`;
		document.body.appendChild( this.hud );

		this.hudPos = this.hud.querySelector( '.pos-num' );
		this.hudTotal = this.hud.querySelector( '.total' );
		this.hudLap = this.hud.querySelector( '.lap-num' );
		this.hudTimer = this.hud.querySelector( '.timer' );
		this.hudLast = this.hud.querySelector( '.last' );
		this.hudBest = this.hud.querySelector( '.best' );

	}

	updateHUD( data ) {

		this.ensureHUD();
		this.hudPos.textContent = data.position;
		this.hudTotal.textContent = `/ ${ data.totalCars }`;
		this.hudLap.textContent = `${ data.lap } / ${ data.totalLaps }`;
		this.hudTimer.textContent = formatTime( data.currentLapTime );
		this.hudLast.textContent = formatTime( data.lastLap );
		this.hudBest.textContent = formatTime( data.bestLap );

	}

	hideHUD() {

		if ( this.hud ) { this.hud.remove(); this.hud = null; }

	}

	showResults( data, { onRaceAgain, onEditTrack } ) {

		this.overlay.classList.add( 'modal-open' );

		const card = document.createElement( 'div' );
		card.className = 'race-card results-card';

		const podiumClass = [ 'first', 'second', 'third' ];

		const rows = data.finishOrder.map( ( row, i ) => {

			const swatch = SWATCH[ row.colorKey ] || '#ffffff';
			const youCls = row.isPlayer ? ' you' : '';
			const youLabel = row.isPlayer ? ' (You)' : '';
			const totalLabel = row.finished ? formatTime( row.totalTime ) : `Lap ${ row.lapsCompleted + 1 }`;
			const podiumCls = podiumClass[ i ] || '';
			return `
				<div class="results-row ${ podiumCls }">
					<div class="pos-cell">${ i + 1 }</div>
					<div class="swatch-cell" style="background:${ swatch }"></div>
					<div class="name-cell${ youCls }">${ row.name }${ youLabel }</div>
					<div class="time-cell">${ totalLabel }<div class="label-cell">total</div></div>
					<div class="time-cell">${ formatTime( row.bestLap ) }<div class="label-cell">best lap</div></div>
				</div>
			`;

		} ).join( '' );

		const winner = data.finishOrder[ 0 ];
		const headline = winner.isPlayer ? 'You Won!' : `${ winner.name } Wins!`;

		card.innerHTML = `
			<h1 class="winner-banner">${ headline }</h1>
			<div class="sub">Race finished. Here's how it shook out.</div>
			${ rows }
			<div class="button-row">
				<button class="secondary" data-action="edit">Edit Track</button>
				<button class="primary" data-action="again">Race Again</button>
			</div>
		`;

		this.overlay.appendChild( card );

		card.addEventListener( 'click', ( e ) => {

			const action = e.target.closest( '[data-action]' )?.dataset.action;
			if ( action === 'again' ) {

				this.overlay.classList.remove( 'modal-open' );
				this.overlay.removeChild( card );
				onRaceAgain();

			} else if ( action === 'edit' ) {

				onEditTrack();

			}

		} );

	}

}
