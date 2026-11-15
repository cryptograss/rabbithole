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
 * Whether what somebody has in hand is their voice.
 *
 * A chart says somebody is singing the way it says everything else: they
 * take it (`solo`), and what they have in hand at that moment
 * (`instrumentChanges`) is their voice. The names are whatever a person
 * typed -- "vocals", "harmony vocals", "throatsinging", "throat singing"
 * and "guitar/ throatsinging" are all on the wiki's charts or in the
 * editor's list -- so each thing in hand is asked, and it is a voice when
 * it ends in vocals or voice, or in singing. Ends in, not contains: a
 * single-row melodeon, a singing saw and a voice flute are instruments
 * (re, #visual-effects, 15 Nov 2026: a looser test read "single" as
 * singing).
 */
export function isVoice( instrument ) {
	return String( instrument || '' ).toLowerCase().split( /[/,&+]|\band\b/ )
		.some( ( one ) => /(?:^|\s)(?:vocals?|voice|vox)$|singing$/.test( one.trim() ) );
}

export function initials( fullName ) {
	return String( fullName ).split( ' ' ).map( ( n ) => n[ 0 ] ).join( '' );
}
