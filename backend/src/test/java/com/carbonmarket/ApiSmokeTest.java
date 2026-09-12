package com.carbonmarket;

import com.carbonmarket.seed.DataSeeder;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "app.seed=true")
@ActiveProfiles("h2")
@AutoConfigureMockMvc
class ApiSmokeTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String login(String email) throws Exception {
        MvcResult r = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + DataSeeder.PASSWORD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return json.readTree(r.getResponse().getContentAsString()).get("token").asText();
    }

    @Test
    void adminCanLogIn() throws Exception {
        String token = login("admin@carbon.local");
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("ADMIN"));
    }

    @Test
    void pendingCompanyCannotLogIn() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"newco@carbon.local\",\"password\":\"" + DataSeeder.PASSWORD + "\"}"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.message").value("Company approval pending"));
    }

    @Test
    void utilizerSeesSeededOpenListingsWithoutEmitterIdentity() throws Exception {
        String token = login("methanol@carbon.local");
        MvcResult r = mvc.perform(get("/api/listings").header("Authorization", "Bearer " + token)).andExpect(status().isOk()).andReturn();
        JsonNode arr = json.readTree(r.getResponse().getContentAsString());
        assertTrue(arr.size() >= 3, "L1, L2, L3 are OPEN");
        boolean sawL3 = false;
        for (JsonNode n : arr) {
            if (n.get("id").asText().equals(DataSeeder.L3.toString())) {
                sawL3 = true;
                assertTrue(n.get("emitterName").isNull(), "identity hidden until a proposal exists");
                assertTrue(n.get("passportTotalVolume").isNull());
            }
            if (n.get("id").asText().equals(DataSeeder.L1.toString())) {
                assertEquals("Saurashtra Cement Works", n.get("emitterName").asText(), "methanol has a proposal on L1 → identity revealed");
            }
        }
        assertTrue(sawL3);
    }

    @Test
    void emitterSeesRankedProposalsWithBreakdownAndRecommendation() throws Exception {
        String token = login("cement@carbon.local");
        MvcResult r = mvc.perform(get("/api/listings/" + DataSeeder.L1 + "/proposals").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn();
        JsonNode arr = json.readTree(r.getResponse().getContentAsString());
        assertEquals(3, arr.size());
        assertEquals(1, arr.get(0).get("rank").asInt());
        assertTrue(arr.get(0).get("score").asDouble() >= arr.get(1).get("score").asDouble());
        assertTrue(arr.get(0).get("recommendation").asText().startsWith("Recommended:"));
        assertEquals(8, arr.get(0).get("scoreBreakdown").get("components").size());
    }

    @Test
    void overAllocatingAPassportReturnsConflict() throws Exception {
        String token = login("cement@carbon.local");
        mvc.perform(post("/api/listings").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"passportId\":\"" + DataSeeder.P342 + "\",\"mode\":\"TENDER\",\"volumeTonnes\":1000,\"basePricePerTonne\":4000}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.startsWith("Insufficient free volume")));
        // within the free 150 t it works, and the allocation reflects it
        mvc.perform(post("/api/listings").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"passportId\":\"" + DataSeeder.P342 + "\",\"mode\":\"TENDER\",\"volumeTonnes\":100,\"basePricePerTonne\":4000}"))
                .andExpect(status().isCreated());
        mvc.perform(get("/api/passports/" + DataSeeder.P342 + "/allocation").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.freeTonnes").value(50.0));
    }

    @Test
    void costEstimateShowsEveryLayerAndCarbon() throws Exception {
        String token = login("methanol@carbon.local");
        mvc.perform(post("/api/costs/estimate").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"listingId\":\"" + DataSeeder.L1 + "\",\"quantityTonnes\":100,\"requiredPurityPct\":98,\"transportMode\":\"TRUCK\",\"impurityLimits\":{\"SOx\":5}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.layers.length()").value(5))
                .andExpect(jsonPath("$.purificationSteps.length()").value(2))
                .andExpect(jsonPath("$.carbon.netCarbonBenefitTonnes").isNumber());
    }

    @Test
    void auditChainIsIntactAndRegulatorSeesFlags() throws Exception {
        String token = login("regulator@carbon.local");
        mvc.perform(get("/api/audit/verify").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.intact").value(true));
        mvc.perform(get("/api/regulator/companies").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.name=='Kutch Thermal Power')].incentiveFlags[*]").isArray());
        mvc.perform(get("/api/listings/mine").header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    }
}
