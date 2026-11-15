/** An emoji for an instrument list's first entry, and a person's initials. */

const ICONS = {
	guitar: '🎸',
	mandolin: '🎸',
	banjo: '🪕',
	'5-string banjo': '🪕',
	fiddle: '🎻',
	violin: '🎻',
	bass: '🎸',
	dobro: '🎸',
	cello: '🎻',
	'tin whistle': '🎵',
	vocals: '🎤',
	throatsinging: '🎤',
};

export function instrumentIcon( instruments ) {
	const list = Array.isArray( instruments ) ? instruments : ( instruments ? [ instruments ] : [] );
	if ( ! list.length ) {
		return '🎵';
	}
	const inst = String( list[ 0 ] ).toLowerCase();
	for ( const [ key, icon ] of Object.entries( ICONS ) ) {
		if ( inst.includes( key ) ) {
			return icon;
		}
	}
	return '🎵';
}

/**
 * Whether an instrument is a voice.
 *
 * A chart says somebody is singing the way it says everything else: they
 * take it (`solo`), and what they have in hand at that moment
 * (`instrumentChanges`) is their voice. "vocals", "harmony vocals",
 * "throatsinging" and "throat singing" are all on the wiki's charts or in
 * the editor's list.
 */
export function isVoice( instrument ) {
	return /vocal|voice|sing/i.test( String( instrument || '' ) );
}

export function initials( fullName ) {
	return String( fullName ).split( ' ' ).map( ( n ) => n[ 0 ] ).join( '' );
}
