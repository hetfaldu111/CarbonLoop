import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();
  const authed = token && req.url.startsWith('/api') && !req.url.startsWith('/api/auth/login') && !req.url.startsWith('/api/public')
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;
  return next(authed).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && auth.isLoggedIn()) {
        auth.logout(true);
      }
      return throwError(() => err);
    }),
  );
};
