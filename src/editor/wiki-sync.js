/**
 * Wiki Sync - PickiPedia Integration for Rabbithole Editor
 *
 * Handles fetching and saving rabbithole metadata from PickiPedia subpages.
 * Data is stored on subpages like Recording:Song_Name/Rabbithole
 */

/**
 * Extract JSON data from RabbitholeData template wikitext
 * @param {string} wikitext - Raw wikitext from the page
 * @returns {Object|null} Parsed JSON data or null if not found
 */
export function parseRabbitholeWikitext(wikitext) {
    if (!wikitext) return null;

    // Match {{RabbitholeData|json=...}}
    const match = wikitext.match(/\{\{RabbitholeData\|json=\s*([\s\S]*?)\}\}/);
    if (!match) {
        // Try alternate format: just raw JSON
        try {
            return JSON.parse(wikitext.trim());
        } catch {
            return null;
        }
    }

    try {
        return JSON.parse(match[1].trim());
    } catch (e) {
        console.error('Failed to parse RabbitholeData JSON:', e);
        return null;
    }
}

/**
 * Format rabbithole data as wikitext with RabbitholeData template
 * @param {Object} data - Timeline and metadata
 * @returns {string} Wikitext
 */
export function formatRabbitholeWikitext(data) {
    const json = JSON.stringify(data, null, 2);
    return `{{RabbitholeData|json=
${json}
}}`;
}

/**
 * Build the subpage title for a recording's rabbithole data
 * @param {string} recordingTitle - The recording page title (e.g., "August (Vowel Sounds)")
 * @returns {string} Subpage title (e.g., "Recording:August (Vowel Sounds)/Rabbithole")
 */
export function getRabbitholeSubpage(recordingTitle) {
    // If it already has Recording: prefix, just add /Rabbithole
    if (recordingTitle.startsWith('Recording:')) {
        return `${recordingTitle}/Rabbithole`;
    }
    return `Recording:${recordingTitle}/Rabbithole`;
}

/**
 * WikiSync class for managing PickiPedia data operations
 *
 * Can work in two modes:
 * 1. Direct API mode - uses fetch() to PickiPedia MediaWiki API
 * 2. MCP mode - uses pickipedia MCP server (for use with Claude Code)
 *
 * The MCP functions are meant to be called from Claude Code context.
 */
export class WikiSync {
    constructor(options = {}) {
        this.baseUrl = options.baseUrl || 'https://pickipedia.xyz';
        this.apiPath = options.apiPath || '/api.php';
        this.lastFetchedRevision = null;
        this.mcpMode = options.mcpMode || false;
    }

    /**
     * Fetch rabbithole data from a recording's subpage
     * @param {string} recordingTitle - Recording page title
     * @returns {Promise<{data: Object|null, revisionId: number|null, exists: boolean}>}
     */
    async fetchRabbitholeData(recordingTitle) {
        const subpage = getRabbitholeSubpage(recordingTitle);

        try {
            const url = new URL(this.apiPath, this.baseUrl);
            url.searchParams.set('action', 'query');
            url.searchParams.set('titles', subpage);
            url.searchParams.set('prop', 'revisions');
            url.searchParams.set('rvprop', 'content|ids');
            url.searchParams.set('rvslots', 'main');
            url.searchParams.set('format', 'json');
            url.searchParams.set('origin', '*');

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const result = await response.json();
            const pages = result.query?.pages;

            if (!pages) {
                return { data: null, revisionId: null, exists: false };
            }

            // MediaWiki returns page ID as key, or -1 for missing pages
            const pageId = Object.keys(pages)[0];
            const page = pages[pageId];

            if (page.missing !== undefined) {
                return { data: null, revisionId: null, exists: false };
            }

            const revision = page.revisions?.[0];
            if (!revision) {
                return { data: null, revisionId: null, exists: true };
            }

            const content = revision.slots?.main?.['*'] || revision['*'];
            const revisionId = revision.revid;

            this.lastFetchedRevision = revisionId;

            const data = parseRabbitholeWikitext(content);
            return { data, revisionId, exists: true };

        } catch (error) {
            console.error('Failed to fetch rabbithole data:', error);
            return { data: null, revisionId: null, exists: false, error };
        }
    }

    /**
     * Save rabbithole data to a recording's subpage
     * Requires authentication (bot credentials or user session)
     * @param {string} recordingTitle - Recording page title
     * @param {Object} data - Timeline and metadata to save
     * @param {Object} options - Save options
     * @param {string} options.summary - Edit summary
     * @param {number} options.baseRevisionId - Revision to base edit on (for conflict detection)
     * @returns {Promise<{success: boolean, revisionId?: number, error?: string}>}
     */
    async saveRabbitholeData(recordingTitle, data, options = {}) {
        const subpage = getRabbitholeSubpage(recordingTitle);
        const wikitext = formatRabbitholeWikitext(data);
        const summary = options.summary || 'Update rabbithole timeline data';

        // For browser-based saving, we need CSRF token
        // This requires the user to be logged in to PickiPedia
        try {
            // First, get a CSRF token
            const tokenUrl = new URL(this.apiPath, this.baseUrl);
            tokenUrl.searchParams.set('action', 'query');
            tokenUrl.searchParams.set('meta', 'tokens');
            tokenUrl.searchParams.set('format', 'json');
            tokenUrl.searchParams.set('origin', '*');

            const tokenResponse = await fetch(tokenUrl, { credentials: 'include' });
            const tokenResult = await tokenResponse.json();
            const csrfToken = tokenResult.query?.tokens?.csrftoken;

            if (!csrfToken || csrfToken === '+\\') {
                return {
                    success: false,
                    error: 'Not authenticated. Please log in to PickiPedia.'
                };
            }

            // Now make the edit
            const editUrl = new URL(this.apiPath, this.baseUrl);
            const formData = new FormData();
            formData.append('action', 'edit');
            formData.append('title', subpage);
            formData.append('text', wikitext);
            formData.append('summary', summary);
            formData.append('token', csrfToken);
            formData.append('format', 'json');

            if (options.baseRevisionId) {
                formData.append('baserevid', options.baseRevisionId.toString());
            }

            const editResponse = await fetch(editUrl, {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            const editResult = await editResponse.json();

            if (editResult.error) {
                return {
                    success: false,
                    error: editResult.error.info || editResult.error.code
                };
            }

            if (editResult.edit?.result === 'Success') {
                return {
                    success: true,
                    revisionId: editResult.edit.newrevid
                };
            }

            return { success: false, error: 'Unknown error' };

        } catch (error) {
            console.error('Failed to save rabbithole data:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check if the page has been edited since we last fetched it
     * @param {string} recordingTitle - Recording page title
     * @returns {Promise<boolean>} True if there's an edit conflict
     */
    async checkForConflict(recordingTitle) {
        if (!this.lastFetchedRevision) {
            return false;
        }

        const { revisionId } = await this.fetchRabbitholeData(recordingTitle);
        return revisionId !== this.lastFetchedRevision;
    }
}

/**
 * Convert track data format used in rabbithole to wiki storage format
 * Normalizes and cleans the data
 * @param {Object} trackData - Internal track data format
 * @returns {Object} Clean data for wiki storage
 */
export function trackDataToWikiFormat(trackData) {
    return {
        timeline: trackData.timeline || {},
        standardSectionLength: trackData.standardSectionLength,
        ensemble: trackData.ensemble,
        // Only include non-empty optional fields
        ...(trackData.colorScheme && { colorScheme: trackData.colorScheme })
    };
}

/**
 * Convert wiki storage format to track data format
 * @param {Object} wikiData - Data from wiki
 * @param {Object} baseTrackData - Base track data with audio info etc
 * @returns {Object} Complete track data
 */
export function wikiFormatToTrackData(wikiData, baseTrackData) {
    return {
        ...baseTrackData,
        timeline: wikiData.timeline || {},
        standardSectionLength: wikiData.standardSectionLength || baseTrackData.standardSectionLength,
        ensemble: wikiData.ensemble || baseTrackData.ensemble,
        colorScheme: wikiData.colorScheme || baseTrackData.colorScheme
    };
}

export default WikiSync;
