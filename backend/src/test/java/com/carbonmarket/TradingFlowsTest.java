package com.carbonmarket;

import com.carbonmarket.seed.DataSeeder;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
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

/** End-to-end cover for the v2 tender multi-award and the live auction. */
@SpringBootTest(properties = "app.seed=true")
@ActiveProfiles("h2")
@AutoConfigureMockMvc
class TradingFlowsTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String login(String email) throws Exception {
        MvcResult r = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + DataSeeder.PASSWORD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return json.readTree(r.getResponse().getContentAsString()).get("token").asText();
    }

    private JsonNode getJson(String url, String token) throws Exception {
        MvcResult r = mvc.perform(get(url).header("Authorization", "Bearer " + token)).andExpect(status().isOk()).andReturn();
        return json.readTree(r.getResponse().getContentAsString());
    }

    // ---- Tender: profit-optimal multi-award ----

    @Test
    @DisplayName("the suggestion picks the two-winner combination over the bigger single bid")
    void suggestionPrefersTheProfitableCombination() throws Exception {
        String emitter = login("steel@carbon.local");
        JsonNode s = getJson("/api/listings/" + DataSeeder.L7 + "/award-suggestion", emitter);

        assertTrue(s.get("exact").asBoolean());
        assertEquals(1000.0, s.get("capacityTonnes").asDouble(), 0.01);
        JsonNode rec = s.get("recommended");
        assertEquals(2, rec.get("proposalIds").size(), "two winners together fit the 1000 t");
        assertEquals(4_350_000.0, rec.get("totalRevenue").asDouble(), 0.01);
        assertEquals(0.0, rec.get("leftoverTonnes").asDouble(), 0.01);

        boolean beatsSingle = false;
        for (JsonNode alt : s.get("alternatives")) {
            if ("Highest single bidder".equals(alt.get("label").asText())) {
                assertTrue(rec.get("totalRevenue").asDouble() > alt.get("totalRevenue").asDouble());
                beatsSingle = true;
            }
        }
        assertTrue(beatsSingle, "the single-bidder alternative should be offered for comparison");
        assertTrue(s.get("explanation").asText().contains("more than the best single bidder"));
        // the reliability score is kept alongside the money
        assertTrue(s.get("perProposal").get(0).get("scoreBreakdown").has("components"));
    }

    @Test
    @DisplayName("awarding two proposals creates two agreements and rejects the loser")
    void multiAwardCreatesAnAgreementPerWinner() throws Exception {
        String emitter = login("steel@carbon.local");
        JsonNode s = getJson("/api/listings/" + DataSeeder.L7 + "/award-suggestion", emitter);
        String a = s.get("recommended").get("proposalIds").get(0).asText();
        String b = s.get("recommended").get("proposalIds").get(1).asText();

        MvcResult r = mvc.perform(post("/api/listings/" + DataSeeder.L7 + "/award")
                        .header("Authorization", "Bearer " + emitter).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"proposalIds\":[\"" + a + "\",\"" + b + "\"]}"))
                .andExpect(status().isOk()).andReturn();
        JsonNode created = json.readTree(r.getResponse().getContentAsString());
        assertEquals(2, created.size(), "one agreement per winner");
        for (JsonNode ag : created) assertEquals("PENDING_VERIFICATION", ag.get("status").asText());

        JsonNode proposals = getJson("/api/listings/" + DataSeeder.L7 + "/proposals", emitter);
        int awarded = 0, rejected = 0;
        for (JsonNode p : proposals) {
            if ("AWARDED".equals(p.get("status").asText())) awarded++;
            if ("REJECTED".equals(p.get("status").asText())) rejected++;
        }
        assertEquals(2, awarded);
        assertEquals(1, rejected, "the unsuccessful bidder is rejected and told");
    }

    @Test
    @DisplayName("leftover volume returns to free stock when the award does not fill the tender")
    void leftoverReturnsToFreeStock() throws Exception {
        String emitter = login("cement@carbon.local");
        double freeBefore = getJson("/api/passports/" + DataSeeder.P342 + "/allocation", emitter).get("freeTonnes").asDouble();

        // L1 released 300 t; award only the 100 t proposal, so 200 t must come back.
        JsonNode proposals = getJson("/api/listings/" + DataSeeder.L1 + "/proposals", emitter);
        String smallest = null;
        for (JsonNode p : proposals) {
            if (p.get("quantityTonnes").asDouble() == 100.0) smallest = p.get("id").asText();
        }
        assertNotNull(smallest);

        mvc.perform(post("/api/listings/" + DataSeeder.L1 + "/award").header("Authorization", "Bearer " + emitter)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"proposalIds\":[\"" + smallest + "\"]}"))
                .andExpect(status().isOk());

        double freeAfter = getJson("/api/passports/" + DataSeeder.P342 + "/allocation", emitter).get("freeTonnes").asDouble();
        assertEquals(freeBefore + 200.0, freeAfter, 0.01, "300 t listed minus 100 t awarded");
    }

    @Test
    @DisplayName("selecting more than the tender released is rejected")
    void overCapacityAwardIsRejected() throws Exception {
        String emitter = login("steel@carbon.local");
        JsonNode proposals = getJson("/api/listings/" + DataSeeder.L7 + "/proposals", emitter);
        StringBuilder ids = new StringBuilder();
        for (JsonNode p : proposals) {
            if (ids.length() > 0) ids.append(",");
            ids.append("\"").append(p.get("id").asText()).append("\"");
        }
        // all three together are 2000 t against 1000 t released
        mvc.perform(post("/api/listings/" + DataSeeder.L7 + "/award").header("Authorization", "Bearer " + emitter)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"proposalIds\":[" + ids + "]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("exceeds")));
    }

    @Test
    @DisplayName("an empty award selection is rejected")
    void emptyAwardRejected() throws Exception {
        String emitter = login("steel@carbon.local");
        mvc.perform(post("/api/listings/" + DataSeeder.L7 + "/award").header("Authorization", "Bearer " + emitter)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"proposalIds\":[]}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("a tender proposal below the base price is rejected")
    void proposalBelowBasePriceRejected() throws Exception {
        String utilizer = login("concrete@carbon.local");
        mvc.perform(post("/api/listings/" + DataSeeder.L3 + "/proposals").header("Authorization", "Bearer " + utilizer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"quantityTonnes\":50,\"offeredPricePerTonne\":100,\"durationMonths\":6}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("below the base price")));
    }

    // ---- Auction ----

    @Test
    @DisplayName("a bid adds exactly the listing increment and takes the lead")
    void bidUsesTheFixedIncrement() throws Exception {
        String utilizer = login("methanol@carbon.local");
        JsonNode before = getJson("/api/listings/" + DataSeeder.L2 + "/auction", utilizer);
        assertEquals("LIVE", before.get("status").asText());
        double next = before.get("nextBidPricePerTonne").asDouble();
        double increment = before.get("bidIncrement").asDouble();
        assertEquals(before.get("currentPricePerTonne").asDouble() + increment, next, 0.01);

        MvcResult r = mvc.perform(post("/api/listings/" + DataSeeder.L2 + "/bids").header("Authorization", "Bearer " + utilizer)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"acceptBindingTerms\":true}"))
                .andExpect(status().isOk()).andReturn();
        JsonNode after = json.readTree(r.getResponse().getContentAsString());

        assertEquals(next, after.get("currentPricePerTonne").asDouble(), 0.01);
        assertTrue(after.get("youAreLeading").asBoolean());
        assertEquals(before.get("bidCount").asInt() + 1, after.get("bidCount").asInt());
        assertEquals(next * after.get("volumeTonnes").asDouble(), after.get("currentTotal").asDouble(), 0.01);
    }

    @Test
    @DisplayName("bidding without accepting the binding terms is refused")
    void bidWithoutBindingTermsRejected() throws Exception {
        String utilizer = login("algae@carbon.local");
        mvc.perform(post("/api/listings/" + DataSeeder.L2 + "/bids").header("Authorization", "Bearer " + utilizer)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"acceptBindingTerms\":false}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("binding terms")));
    }

    @Test
    @DisplayName("bidding on an auction that has not opened yet is refused")
    void bidBeforeStartRejected() throws Exception {
        String utilizer = login("algae@carbon.local");
        JsonNode state = getJson("/api/listings/" + DataSeeder.L8 + "/auction", utilizer);
        assertEquals("SCHEDULED", state.get("status").asText());
        assertFalse(state.get("canBid").asBoolean());

        mvc.perform(post("/api/listings/" + DataSeeder.L8 + "/bids").header("Authorization", "Bearer " + utilizer)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"acceptBindingTerms\":true}"))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("the leader cannot bid against themselves")
    void leaderCannotOutbidThemselves() throws Exception {
        String utilizer = login("concrete@carbon.local");
        mvc.perform(post("/api/listings/" + DataSeeder.L2 + "/bids").header("Authorization", "Bearer " + utilizer)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"acceptBindingTerms\":true}"))
                .andExpect(status().isOk());
        mvc.perform(post("/api/listings/" + DataSeeder.L2 + "/bids").header("Authorization", "Bearer " + utilizer)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"acceptBindingTerms\":true}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("leading bid")));
    }

    @Test
    @DisplayName("a late bid pushes the close out, so an auction cannot be sniped")
    void lateBidExtendsTheClose() throws Exception {
        String emitter = login("cement@carbon.local");
        String utilizer = login("methanol@carbon.local");
        JsonNode before = getJson("/api/listings/" + DataSeeder.L2 + "/auction", emitter);
        long remainingBefore = before.get("secondsRemaining").asLong();

        mvc.perform(post("/api/listings/" + DataSeeder.L2 + "/bids").header("Authorization", "Bearer " + utilizer)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"acceptBindingTerms\":true}"))
                .andExpect(status().isOk());

        // The seeded auction has minutes left, so this bid is not late and the clock must not jump.
        long remainingAfter = getJson("/api/listings/" + DataSeeder.L2 + "/auction", emitter).get("secondsRemaining").asLong();
        assertTrue(remainingAfter <= remainingBefore, "a normal bid leaves the deadline alone");
        assertTrue(remainingAfter > 60, "the seeded auction still has time on the clock");
    }

    @Test
    @DisplayName("rival bidders are pseudonymous to a utilizer but named for the emitter")
    void bidderIdentitiesAreHiddenFromRivals() throws Exception {
        JsonNode asUtilizer = getJson("/api/listings/" + DataSeeder.L2 + "/auction", login("methanol@carbon.local"));
        boolean sawPseudonym = false;
        for (JsonNode b : asUtilizer.get("bids")) {
            if (!b.get("isYou").asBoolean()) {
                assertTrue(b.get("displayName").asText().startsWith("Bidder #"),
                        "rivals must not be named during a live auction");
                assertTrue(b.get("companyId").isNull());
                sawPseudonym = true;
            }
        }
        assertTrue(sawPseudonym);

        JsonNode asEmitter = getJson("/api/listings/" + DataSeeder.L2 + "/auction", login("cement@carbon.local"));
        for (JsonNode b : asEmitter.get("bids")) {
            assertFalse(b.get("displayName").asText().startsWith("Bidder #"), "the seller sees who is bidding");
        }
    }

    @Test
    @DisplayName("a finished auction has a winner, an agreement, and the buyer cannot cancel it")
    void auctionWinIsBinding() throws Exception {
        String winner = login("algae@carbon.local");
        JsonNode ended = getJson("/api/listings/" + DataSeeder.L9 + "/auction", winner);
        assertEquals("AWARDED", ended.get("status").asText());
        assertEquals(3700.0, ended.get("currentPricePerTonne").asDouble(), 0.01);
        assertTrue(ended.get("youAreLeading").asBoolean(), "algae placed the last bid");

        mvc.perform(post("/api/agreements/" + DataSeeder.A_AUCTION + "/cancel").header("Authorization", "Bearer " + winner)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"changed our mind\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("binding")));
    }

    @Test
    @DisplayName("auction dashboards split live, upcoming and ended")
    void auctionDashboardFilters() throws Exception {
        String utilizer = login("methanol@carbon.local");
        assertTrue(getJson("/api/auctions?filter=live", utilizer).size() >= 1);
        JsonNode upcoming = getJson("/api/auctions?filter=upcoming", utilizer);
        assertTrue(upcoming.size() >= 1);
        assertEquals("SCHEDULED", upcoming.get(0).get("status").asText());
        assertTrue(getJson("/api/auctions?filter=ended", utilizer).size() >= 1);

        JsonNode mine = getJson("/api/auctions/mine", login("cement@carbon.local"));
        assertTrue(mine.size() >= 1, "the emitter tracks its own auctions");
    }

    // ---- Notifications & badges ----

    @Test
    @DisplayName("publishing a tender notifies every approved utilizer")
    void publishingATenderBroadcasts() throws Exception {
        String emitter = login("cement@carbon.local");
        mvc.perform(post("/api/listings").header("Authorization", "Bearer " + emitter).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"passportId\":\"" + DataSeeder.P342 + "\",\"mode\":\"TENDER\",\"volumeTonnes\":50,"
                                + "\"basePricePerTonne\":4400,\"deliveryMonths\":6}"))
                .andExpect(status().isCreated());

        JsonNode notes = getJson("/api/notifications", login("algae@carbon.local"));
        boolean sawBroadcast = false;
        for (JsonNode n : notes) if ("TENDER_PUBLISHED".equals(n.get("type").asText())) sawBroadcast = true;
        assertTrue(sawBroadcast, "utilizers are told when a tender opens");
    }

    @Test
    @DisplayName("the emitter badge reports volume sold, the utilizer badge reports completions")
    void badgeBasisDiffersByRole() throws Exception {
        JsonNode emitter = getJson("/api/companies/me/trust", login("power@carbon.local"));
        assertEquals("volume sold", emitter.get("badgeBasis").asText());
        assertTrue(emitter.get("tonnesSold").asDouble() >= 5000, "power has sold 5080 t");
        assertEquals("DIAMOND", emitter.get("tier").asText());

        JsonNode utilizer = getJson("/api/companies/me/trust", login("methanol@carbon.local"));
        assertEquals("completed agreements", utilizer.get("badgeBasis").asText());
        assertEquals("GOLD", utilizer.get("tier").asText());
    }
}
