import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { AuthUser, LoginResponse, RegisterRequest, RegisterResponse, Role } from './models';

const TOKEN_KEY = 'cm.token';
const USER_KEY = 'cm.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  readonly token = signal<string | null>(safeGet(TOKEN_KEY));
  readonly user = signal<AuthUser | null>(parseUser(safeGet(USER_KEY)));
  readonly isLoggedIn = computed(() => !!this.token() && !!this.user());
  readonly role = computed<Role | null>(() => this.user()?.role ?? null);

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>('/api/auth/login', { email, password }).pipe(
      tap((res) => this.setSession(res.token, res.user)),
    );
  }

  register(req: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>('/api/auth/register', req);
  }

  me(): Observable<AuthUser> {
    return this.http.get<AuthUser>('/api/auth/me').pipe(tap((u) => this.setSession(this.token()!, u)));
  }

  logout(redirect = true): void {
    this.token.set(null);
    this.user.set(null);
    safeRemove(TOKEN_KEY);
    safeRemove(USER_KEY);
    if (redirect) this.router.navigateByUrl('/login');
  }

  hasRole(...roles: Role[]): boolean {
    const r = this.role();
    return !!r && roles.includes(r);
  }

  homeFor(role: Role | null): string {
    switch (role) {
      case 'ADMIN': return '/admin';
      case 'EMITTER': return '/emitter';
      case 'UTILIZER': return '/utilizer';
      case 'TRANSPORT': return '/transport';
      case 'LAB': return '/lab';
      case 'REGULATOR': return '/regulator';
      default: return '/';
    }
  }

  private setSession(token: string, user: AuthUser): void {
    this.token.set(token);
    this.user.set(user);
    safeSet(TOKEN_KEY, token);
    safeSet(USER_KEY, JSON.stringify(user));
  }
}

function safeGet(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k: string, v: string): void { try { localStorage.setItem(k, v); } catch { /* ignore */ } }
function safeRemove(k: string): void { try { localStorage.removeItem(k); } catch { /* ignore */ } }
function parseUser(s: string | null): AuthUser | null { if (!s) return null; try { return JSON.parse(s) as AuthUser; } catch { return null; } }
