package com.carbonmarket.config;

import com.carbonmarket.domain.Role;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.UUID;

@Service
public class JwtService {
    private final SecretKey key;
    private final int expiryHours;

    public JwtService(AppProperties props) {
        this.key = Keys.hmacShaKeyFor(props.getJwtSecret().getBytes(StandardCharsets.UTF_8));
        this.expiryHours = props.getJwtExpiryHours();
    }

    public String issue(AuthUser user) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(user.userId().toString())
                .claim("email", user.email())
                .claim("role", user.role().name())
                .claim("companyId", user.companyId().toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(expiryHours, ChronoUnit.HOURS)))
                .signWith(key)
                .compact();
    }

    public AuthUser parse(String token) {
        Claims c = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
        return new AuthUser(
                UUID.fromString(c.getSubject()),
                UUID.fromString(c.get("companyId", String.class)),
                c.get("email", String.class),
                Role.valueOf(c.get("role", String.class)));
    }
}
