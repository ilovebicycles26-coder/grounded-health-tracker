// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { BrowserAuthStorage } from './browserAuthStorage';
describe('BrowserAuthStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  it('uses session storage by default', () => {
    const storage = new BrowserAuthStorage(localStorage, sessionStorage);
    storage.setItem('sb-project-auth-token', 'token');
    expect(sessionStorage.getItem('sb-project-auth-token')).toBe('token');
    expect(localStorage.getItem('sb-project-auth-token')).toBeNull();
  });
  it('migrates auth data when stay signed in changes', () => {
    const storage = new BrowserAuthStorage(localStorage, sessionStorage);
    storage.setItem('sb-project-auth-token', 'token');
    storage.setPersistence('durable');
    expect(localStorage.getItem('sb-project-auth-token')).toBe('token');
    expect(sessionStorage.getItem('sb-project-auth-token')).toBeNull();
  });
});
