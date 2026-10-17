import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { setupAuthInterceptors } from '../src/utils/authInterceptors.js';

function response(config, data, status = 200) {
    return { config, data, status, statusText: String(status), headers: {} };
}

function fail(config, status) {
    throw new axios.AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, response(config, {}, status));
}

function createClient(adapter, refreshAdapter) {
    const values = new Map([['access', 'expired'], ['refresh', 'refresh-token']]);
    const storage = {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: (key) => values.delete(key),
    };
    const api = axios.create({ adapter });
    const expiredEvents = [];
    setupAuthInterceptors(api, {
        refreshClient: axios.create({ adapter: refreshAdapter }),
        storage,
        onSessionExpired: () => expiredEvents.push(true),
    });
    return { api, storage, expiredEvents };
}

test('concurrent expired requests refresh once and retry with the new token', async () => {
    let refreshCalls = 0;
    const requests = [];
    const { api, storage } = createClient(async (config) => {
        requests.push(config.headers.Authorization);
        if (config.headers.Authorization === 'Bearer expired') fail(config, 401);
        return response(config, { ok: true });
    }, async (config) => {
        refreshCalls += 1;
        assert.equal(config.headers.Authorization, undefined);
        await new Promise(resolve => setTimeout(resolve, 10));
        return response(config, { access: 'renewed', refresh: 'rotated' });
    });
    const results = await Promise.all([api.get('users/me/'), api.get('courses/')]);
    assert.equal(refreshCalls, 1);
    assert.deepEqual(results.map(result => result.data), [{ ok: true }, { ok: true }]);
    assert.equal(storage.getItem('refresh'), 'rotated');
    assert.deepEqual(requests, ['Bearer expired', 'Bearer expired', 'Bearer renewed', 'Bearer renewed']);
});

test('a delayed old-token response reuses the already refreshed access token', async () => {
    let refreshCalls = 0;
    const { api } = createClient(async (config) => {
        if (config.headers.Authorization === 'Bearer expired') {
            if (config.url === 'slow/') await new Promise(resolve => setTimeout(resolve, 20));
            fail(config, 401);
        }
        return response(config, {});
    }, async config => {
        refreshCalls += 1;
        return response(config, { access: 'renewed' });
    });
    await Promise.all([api.get('fast/'), api.get('slow/')]);
    assert.equal(refreshCalls, 1);
});

test('invalid refresh clears the session and notifies the app once', async () => {
    const { api, storage, expiredEvents } = createClient(config => fail(config, 401), async config => {
        await new Promise(resolve => setTimeout(resolve, 10));
        fail(config, 401);
    });
    const results = await Promise.allSettled([api.get('users/me/'), api.get('courses/')]);
    assert.ok(results.every(result => result.status === 'rejected'));
    assert.equal(storage.getItem('access'), null);
    assert.equal(storage.getItem('refresh'), null);
    assert.equal(expiredEvents.length, 1);
});

test('temporary refresh failure preserves credentials for a later retry', async () => {
    const { api, storage, expiredEvents } = createClient(config => fail(config, 401), config => fail(config, 503));
    await assert.rejects(api.get('users/me/'), error => error.response.status === 503);
    assert.equal(storage.getItem('access'), 'expired');
    assert.equal(storage.getItem('refresh'), 'refresh-token');
    assert.equal(expiredEvents.length, 0);
});

test('login does not attach stale credentials or refresh after invalid credentials', async () => {
    let refreshCalls = 0;
    const { api, expiredEvents } = createClient(config => {
        assert.equal(config.headers.Authorization, undefined);
        fail(config, 401);
    }, () => { refreshCalls += 1; });
    await assert.rejects(api.post('users/login/', { username: 'demo', password: 'wrong' }));
    assert.equal(refreshCalls, 0);
    assert.equal(expiredEvents.length, 0);
});

test('rejected renewed token does not cause an endless refresh loop', async () => {
    let refreshCalls = 0;
    const { api, expiredEvents, storage } = createClient(config => fail(config, 401), async config => {
        refreshCalls += 1;
        return response(config, { access: 'renewed' });
    });
    await assert.rejects(api.get('users/me/'));
    assert.equal(refreshCalls, 1);
    assert.equal(expiredEvents.length, 1);
    assert.equal(storage.getItem('access'), null);
});

test('refresh finishing after logout does not restore the old session', async () => {
    let finishRefresh;
    let startedRefresh;
    const started = new Promise(resolve => { startedRefresh = resolve; });
    const { api, storage } = createClient(config => fail(config, 401), config => new Promise(resolve => {
        finishRefresh = () => resolve(response(config, { access: 'renewed' }));
        startedRefresh();
    }));
    const pending = api.get('users/me/');
    await started;
    storage.removeItem('access');
    storage.removeItem('refresh');
    finishRefresh();
    await assert.rejects(pending, error => axios.isCancel(error));
    assert.equal(storage.getItem('access'), null);
});
