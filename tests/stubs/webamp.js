// The player imports webamp and packery at module scope, and webamp touches
// window on import. These stubs let the pure timeline and weighting logic be
// tested under node without a DOM; nothing here is exercised by the tests.
export default class Webamp {}
