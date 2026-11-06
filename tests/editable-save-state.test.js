import { describe, it, expect } from 'vitest';
import { EditableTrackData } from '../src/editor/EditableTrackData.js';

const make = (opts = {}) => new EditableTrackData({
    title: 'Cicada Song', timeline: { '0': { part: 'intro' } },
    ensemble: { 'Justin Holmes': ['flute'] },
}, { enableBackup: false, restoreBackup: false, ...opts });

/*
 * "Saved" means the wiki made a revision. Twice in one night an edit that
 * never reached PickiPedia looked saved, because a clean editor said
 * "Saved" on open and a save answered "Saved!" without reading the answer.
 */
describe('what "Saved" means', () => {
    it('a fresh editor has no changes, and has not saved anything', () => {
        const d = make();
        expect(d.lastSave).toBeNull();
        expect(d.saveStateText()).toBe('No changes');
    });

    it('an edit is unsaved until the wiki answers', () => {
        const d = make();
        d.workingData.ensemble['Justin Holmes'] = ['flute', 'guitar'];
        expect(d.saveStateText()).toBe('Unsaved changes');
    });

    it('a save that made a revision says which one', () => {
        const d = make();
        d.workingData.ensemble['Justin Holmes'] = ['guitar'];
        d.markSaved({ revisionId: 14701 });
        expect(d.isDirty).toBe(false);
        expect(d.saveStateText()).toBe('Saved, revision 14701');
    });

    it('a save the wiki already had is not called Saved', () => {
        const d = make();
        d.workingData.ensemble['Justin Holmes'] = ['guitar'];
        d.markSaved({ unchanged: true });
        expect(d.isDirty).toBe(false);
        expect(d.saveStateText()).toBe('PickiPedia already had this');
    });

    it('raw text typed but not applied counts as unsaved', () => {
        const seen = [];
        const d = make({ onDirtyChange: (unsaved, text) => seen.push([unsaved, text]) });
        d.setPendingRaw(true);
        expect(d.isDirty).toBe(false);
        expect(d.hasUnsaved).toBe(true);
        expect(d.saveStateText()).toBe('Edited, not yet applied');
        d.setPendingRaw(false);
        expect(seen).toEqual([[true, 'Edited, not yet applied'], [false, 'No changes']]);
    });

    it('tells the shell the words along with the flag', () => {
        const seen = [];
        const d = make({ onDirtyChange: (dirty, text) => seen.push([dirty, text]) });
        d.workingData.timeline['10'] = { part: 'verse' };
        d._notifyChange();
        d.markSaved({ revisionId: 7 });
        expect(seen).toEqual([[true, 'Unsaved changes'], [false, 'Saved, revision 7']]);
    });
});
