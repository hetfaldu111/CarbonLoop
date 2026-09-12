package com.carbonmarket.web;

import com.carbonmarket.dto.ListingDtos.PublicListingDto;
import com.carbonmarket.dto.MiscDtos.ImpactDto;
import com.carbonmarket.service.PublicService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/public")
public class PublicController {
    private final PublicService service;

    public PublicController(PublicService service) { this.service = service; }

    @GetMapping("/impact")
    public ImpactDto impact() { return service.impact(); }

    @GetMapping("/listings")
    public List<PublicListingDto> listings() { return service.listings(); }
}
