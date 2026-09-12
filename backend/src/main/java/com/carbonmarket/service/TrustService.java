package com.carbonmarket.service;

import com.carbonmarket.domain.Agreement;
import com.carbonmarket.domain.AgreementStatus;
import com.carbonmarket.domain.Company;
import com.carbonmarket.domain.Role;
import com.carbonmarket.domain.TrustProfile;
import com.carbonmarket.dto.CompanyDtos.TrustDto;
import com.carbonmarket.repository.AgreementRepository;
import com.carbonmarket.repository.CompanyRepository;
import com.carbonmarket.repository.TrustProfileRepository;
import com.carbonmarket.scoring.TrustScoring;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class TrustService {
    public static final String UTILIZER_FORMULA =
            "hidden_score = clamp((completed / total) × 100 − cancellations_before_expiry × 15, 0, 100); new companies start at completion rate 0.5. "
            + "Tier: <40 Bronze, 40–69 Silver, 70–89 Gold, ≥90 Diamond.";
    public static final String EMITTER_FORMULA =
            "Emitter badge = cumulative tonnes sold across ACTIVE and COMPLETED agreements. "
            + "Tier: <500 t Bronze, 500–1,999 t Silver, 2,000–4,999 t Gold, ≥5,000 t Diamond. "
            + "The reliability score (completed / total agreements) is still tracked and shown alongside.";
    /** Kept for callers that just want "the formula" without knowing the role. */
    public static final String FORMULA = UTILIZER_FORMULA;

    private final TrustProfileRepository repo;
    private final CompanyRepository companies;
    private final AgreementRepository agreements;

    public TrustService(TrustProfileRepository repo, CompanyRepository companies, AgreementRepository agreements) {
        this.repo = repo;
        this.companies = companies;
        this.agreements = agreements;
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

    /**
     * Re-reads an emitter's sold volume and re-bands its badge. Call after anything that moves an
     * agreement into or out of ACTIVE/COMPLETED — award, lab approval, completion, cancellation.
     */
    @Transactional
    public void refreshBadge(UUID... companyIds) {
        for (UUID id : companyIds) {
            if (id == null) continue;
            TrustProfile t = getOrCreate(id);
            recompute(t);
            repo.save(t);
        }
    }

    private void recompute(TrustProfile t) {
        t.setHiddenScore(TrustScoring.hiddenScore(t.getTotalAgreements(), t.getCompletedAgreements(), t.getCancellationsBeforeExpiry()));
        t.setTonnesSold(tonnesSold(t.getCompanyId()));
        t.setTier(isEmitter(t.getCompanyId())
                ? TrustScoring.tierForTonnesSold(t.getTonnesSold())
                : TrustScoring.tierFor(t.getHiddenScore()));
        t.setUpdatedAt(Instant.now());
    }

    private boolean isEmitter(UUID companyId) {
        return companyId != null && companies.findById(companyId).map(c -> c.getRole() == Role.EMITTER).orElse(false);
    }

    /** Cumulative tonnes an emitter has actually sold: ACTIVE plus COMPLETED agreements. */
    private double tonnesSold(UUID companyId) {
        if (companyId == null) return 0;
        List<Agreement> sold = agreements.findByEmitterIdAndStatusIn(companyId,
                List.of(AgreementStatus.ACTIVE, AgreementStatus.COMPLETED));
        double sum = 0;
        for (Agreement a : sold) sum += a.getVolumeTonnes();
        return Math.round(sum * 100.0) / 100.0;
    }

    @Transactional
    public TrustDto dto(UUID companyId) {
        TrustProfile t = getOrCreate(companyId);
        Company c = companies.findById(companyId).orElse(null);
        boolean emitter = c != null && c.getRole() == Role.EMITTER;
        return new TrustDto(companyId, c == null ? null : c.getName(), t.getTier(), t.getHiddenScore(),
                t.getTotalAgreements(), t.getCompletedAgreements(), t.getCancellationsBeforeExpiry(),
                round(t.cancellationRate()),
                round(TrustScoring.completionRate(t.getTotalAgreements(), t.getCompletedAgreements())),
                emitter ? EMITTER_FORMULA : UTILIZER_FORMULA, t.getTonnesSold(),
                emitter ? "volume sold" : "completed agreements");
    }

    private static double round(double v) { return Math.round(v * 1000.0) / 1000.0; }
}
