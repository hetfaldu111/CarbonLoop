package com.carbonmarket.service;

import com.carbonmarket.domain.Company;
import com.carbonmarket.domain.TrustProfile;
import com.carbonmarket.dto.CompanyDtos.TrustDto;
import com.carbonmarket.repository.CompanyRepository;
import com.carbonmarket.repository.TrustProfileRepository;
import com.carbonmarket.scoring.TrustScoring;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
public class TrustService {
    public static final String FORMULA =
            "hidden_score = clamp((completed / total) × 100 − cancellations_before_expiry × 15, 0, 100); new companies start at completion rate 0.5. "
            + "Tier: <40 Bronze, 40–69 Silver, 70–89 Gold, ≥90 Diamond.";

    private final TrustProfileRepository repo;
    private final CompanyRepository companies;

    public TrustService(TrustProfileRepository repo, CompanyRepository companies) {
        this.repo = repo;
        this.companies = companies;
    }

    @Transactional
    public TrustProfile getOrCreate(UUID companyId) {
        return repo.findById(companyId).orElseGet(() -> {
            TrustProfile t = new TrustProfile();
            t.setCompanyId(companyId);
            recompute(t);
            return repo.save(t);
        });
    }

    @Transactional
    public TrustProfile set(UUID companyId, int total, int completed, int cancellations) {
        TrustProfile t = getOrCreate(companyId);
        t.setTotalAgreements(total);
        t.setCompletedAgreements(completed);
        t.setCancellationsBeforeExpiry(cancellations);
        recompute(t);
        return repo.save(t);
    }

    @Transactional
    public void onAgreementCreated(UUID... companyIds) {
        for (UUID id : companyIds) {
            TrustProfile t = getOrCreate(id);
            t.setTotalAgreements(t.getTotalAgreements() + 1);
            recompute(t);
            repo.save(t);
        }
    }

    @Transactional
    public void onAgreementCompleted(UUID... companyIds) {
        for (UUID id : companyIds) {
            TrustProfile t = getOrCreate(id);
            t.setCompletedAgreements(t.getCompletedAgreements() + 1);
            recompute(t);
            repo.save(t);
        }
    }

    @Transactional
    public void onAgreementCancelledEarly(UUID cancellingCompanyId) {
        TrustProfile t = getOrCreate(cancellingCompanyId);
        t.setCancellationsBeforeExpiry(t.getCancellationsBeforeExpiry() + 1);
        recompute(t);
        repo.save(t);
    }

    private void recompute(TrustProfile t) {
        t.setHiddenScore(TrustScoring.hiddenScore(t.getTotalAgreements(), t.getCompletedAgreements(), t.getCancellationsBeforeExpiry()));
        t.setTier(TrustScoring.tierFor(t.getHiddenScore()));
        t.setUpdatedAt(Instant.now());
    }

    @Transactional
    public TrustDto dto(UUID companyId) {
        TrustProfile t = getOrCreate(companyId);
        String name = companies.findById(companyId).map(Company::getName).orElse(null);
        return new TrustDto(companyId, name, t.getTier(), t.getHiddenScore(), t.getTotalAgreements(), t.getCompletedAgreements(),
                t.getCancellationsBeforeExpiry(), round(t.cancellationRate()),
                round(TrustScoring.completionRate(t.getTotalAgreements(), t.getCompletedAgreements())), FORMULA);
    }

    private static double round(double v) { return Math.round(v * 1000.0) / 1000.0; }
}
