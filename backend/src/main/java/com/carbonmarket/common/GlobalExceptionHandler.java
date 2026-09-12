package com.carbonmarket.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ApiError> notFound(NotFoundException e) { return build(HttpStatus.NOT_FOUND, e.getMessage()); }

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ApiError> conflict(ConflictException e) { return build(HttpStatus.CONFLICT, e.getMessage()); }

    @ExceptionHandler({BadRequestException.class, IllegalArgumentException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<ApiError> badRequest(Exception e) { return build(HttpStatus.BAD_REQUEST, e.getMessage()); }

    @ExceptionHandler({ForbiddenException.class, AccessDeniedException.class})
    public ResponseEntity<ApiError> forbidden(Exception e) {
        String msg = e instanceof AccessDeniedException ? "Access denied for your role" : e.getMessage();
        return build(HttpStatus.FORBIDDEN, msg);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> validation(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + " " + f.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return build(HttpStatus.BAD_REQUEST, msg.isEmpty() ? "Validation failed" : msg);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> generic(Exception e) {
        log.error("Unhandled error", e);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "Unexpected error: " + e.getMessage());
    }

    private ResponseEntity<ApiError> build(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(ApiError.of(status.value(), message));
    }
}
