import test from 'node:test';
import assert from 'node:assert/strict';
import { getMediaUrl } from '../src/utils/mediaUrl.js';

test('HTTPS media and local upload previews keep their valid URLs', () => {
    assert.equal(getMediaUrl('https://saqbol.asia/api/media/avatar.png', '/api/', 'https://saqbol.asia'), 'https://saqbol.asia/api/media/avatar.png');
    assert.equal(getMediaUrl('blob:https://saqbol.asia/upload', '/api/', 'https://saqbol.asia'), 'blob:https://saqbol.asia/upload');
});

test('relative media uses the current deployment instead of localhost', () => {
    assert.equal(getMediaUrl('/api/media/avatar.png', '/api/', 'https://saqbol.asia'), 'https://saqbol.asia/api/media/avatar.png');
    assert.equal(getMediaUrl('api/media/avatar.png', '/api/', 'https://saqbol.asia'), 'https://saqbol.asia/api/media/avatar.png');
});

test('a separately configured API host also serves relative media', () => {
    assert.equal(getMediaUrl('/api/media/avatar.png', 'https://api.saqbol.asia/api/', 'https://saqbol.asia'), 'https://api.saqbol.asia/api/media/avatar.png');
    assert.equal(getMediaUrl(null, '/api/', 'https://saqbol.asia'), null);
});
