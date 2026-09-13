package com.carbonmarket.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

@ConfigurationProperties(prefix = "app")
public class AppProperties {
    private boolean seed = false;
    private String jwtSecret;
    private int jwtExpiryHours = 24;
    private double platformFeePct = 0;
    /**
     * Browser origins allowed to call this API. Patterns, so a wildcard host works.
     * Override per environment, e.g. APP_CORS_ORIGINS=https://your-app.vercel.app
     */
    private List<String> corsOrigins = List.of("http://localhost:4200", "http://127.0.0.1:4200");

    public boolean isSeed() { return seed; }
    public void setSeed(boolean seed) { this.seed = seed; }
    public String getJwtSecret() { return jwtSecret; }
    public void setJwtSecret(String jwtSecret) { this.jwtSecret = jwtSecret; }
    public int getJwtExpiryHours() { return jwtExpiryHours; }
    public void setJwtExpiryHours(int jwtExpiryHours) { this.jwtExpiryHours = jwtExpiryHours; }
    public double getPlatformFeePct() { return platformFeePct; }
    public void setPlatformFeePct(double platformFeePct) { this.platformFeePct = platformFeePct; }
    public List<String> getCorsOrigins() { return corsOrigins; }
    public void setCorsOrigins(List<String> corsOrigins) { this.corsOrigins = corsOrigins; }
}
