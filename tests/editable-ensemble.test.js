import { describe, it, expect } from 'vitest';
import { EditableTrackData } from '../src/editor/EditableTrackData.js';

const make = () => new EditableTrackData({
    title: 'Swords', timeline: { '0': { part: 'intro' } },
    ensemble: { 'Harry Clark': [], 'Maddie Denton': [] },
});

describe('ensemble edits', () => {
    it('count as unsaved changes', () => {
        const d = make();
        expect(d.isDirty).toBe(false);
        d._saveUndoState();
        d.workingData.ensemble['Harry Clark'] = ['guitar'];
        expect(d.isDirty).toBe(true);
    });

    it('undo and redo bring instruments back and forth', () => {
        const d = make();
        d._saveUndoState();
        d.workingData.ensemble['Maddie Denton'] = ['fiddle'];
        d.undo();
        expect(d.workingData.ensemble['Maddie Denton']).toEqual([]);
        expect(d.workingData.timeline).toEqual({ '0': { part: 'intro' } });
        d.redo();
        expect(d.workingData.ensemble['Maddie Denton']).toEqual(['fiddle']);
    });

    it('undo still works on a track with no ensemble', () => {
        const d = new EditableTrackData({ title: 'x', timeline: { '0': { part: 'A' } } });
        d._saveUndoState();
        d.workingData.timeline['5'] = { part: 'B' };
        d.undo();
        expect(d.workingData.timeline).toEqual({ '0': { part: 'A' } });
        expect(d.isDirty).toBe(false);
    });
});
