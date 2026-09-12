package com.carbonmarket.service;

import com.carbonmarket.common.NotFoundException;
import com.carbonmarket.domain.Notification;
import com.carbonmarket.dto.MiscDtos.NotificationDto;
import com.carbonmarket.repository.NotificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class NotificationService {
    private final NotificationRepository repo;

    public NotificationService(NotificationRepository repo) { this.repo = repo; }

    @Transactional
    public Notification notify(UUID companyId, String type, String title, String message, String refType, Object refId) {
        Notification n = new Notification();
        n.setCompanyId(companyId);
        n.setType(type);
        n.setTitle(title);
        n.setMessage(message);
        n.setReferenceType(refType);
        n.setReferenceId(refId == null ? null : refId.toString());
        return repo.save(n);
    }

    @Transactional(readOnly = true)
    public List<NotificationDto> list(UUID companyId) {
        return repo.findByCompanyIdOrderByCreatedAtDesc(companyId).stream().map(NotificationDto::from).toList();
    }

    @Transactional(readOnly = true)
    public long unreadCount(UUID companyId) { return repo.countByCompanyIdAndReadFalse(companyId); }

    @Transactional
    public NotificationDto markRead(UUID companyId, UUID id) {
        Notification n = repo.findById(id).filter(x -> x.getCompanyId().equals(companyId))
                .orElseThrow(() -> new NotFoundException("Notification not found"));
        n.setRead(true);
        return NotificationDto.from(repo.save(n));
    }

    @Transactional
    public int markAllRead(UUID companyId) {
        List<Notification> unread = repo.findByCompanyIdAndReadFalse(companyId);
        unread.forEach(n -> n.setRead(true));
        repo.saveAll(unread);
        return unread.size();
    }
}
