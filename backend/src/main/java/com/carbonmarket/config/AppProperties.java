package com.carbonmarket.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public class AppProperties {
    private boolean seed = false;
    private String jwtSecret;
    private int jwtExpiryHours = 24;
    private double platformFeePct = 0;

    public boolean isSeed() { return seed; }
    public void setSeed(boolean seed) { this.seed = seed; }
    public String getJwtSecret() { return jwtSecret; }
    public void setJwtSecret(String jwtSecret) { this.jwtSecret = jwtSecret; }
    public int getJwtExpiryHours() { return jwtExpiryHours; }
    public void setJwtExpiryHours(int jwtExpiryHours) { this.jwtExpiryHours = jwtExpiryHours; }
    public double getPlatformFeePct() { return platformFeePct; }
    public void setPlatformFeePct(double platformFeePct) { this.platformFeePct = platformFeePct; }
}
