package com.carbonmarket.web;

import com.carbonmarket.config.CurrentUser;
import com.carbonmarket.dto.AuthDtos.*;
import com.carbonmarket.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService auth;
    private final CurrentUser current;

    public AuthController(AuthService auth, CurrentUser current) { this.auth = auth; this.current = current; }

    @PostMapping("/register")
    public ResponseEntity<RegisterResponse> register(@Valid @RequestBody RegisterRequest r) {
        return ResponseEntity.status(HttpStatus.CREATED).body(auth.register(r));
    }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest r) { return auth.login(r); }

    @GetMapping("/me")
    public UserDto me() { return auth.me(current.get()); }
}
