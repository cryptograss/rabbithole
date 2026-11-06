import { ref, onScopeDispose, getCurrentScope } from 'vue';

/** A media query as a ref that follows the window: rotate, resize, zoom. */
export function useMediaQuery( query ) {
	const matches = ref( false );
	if ( typeof window === 'undefined' || ! window.matchMedia ) {
		return matches;
	}
	const mq = window.matchMedia( query );
	matches.value = mq.matches;
	const update = ( e ) => {
		matches.value = e.matches;
	};
	mq.addEventListener( 'change', update );
	if ( getCurrentScope() ) {
		onScopeDispose( () => mq.removeEventListener( 'change', update ) );
	}
	return matches;
}
