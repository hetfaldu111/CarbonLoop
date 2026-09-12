package com.carbonmarket.repository;

import com.carbonmarket.domain.Company;
import com.carbonmarket.domain.CompanyStatus;
import com.carbonmarket.domain.Role;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CompanyRepository extends JpaRepository<Company, UUID> {
    List<Company> findByStatusOrderByCreatedAtAsc(CompanyStatus status);
    List<Company> findByRoleAndStatus(Role role, CompanyStatus status);
    List<Company> findByRole(Role role);
    List<Company> findAllByOrderByCreatedAtAsc();
}
