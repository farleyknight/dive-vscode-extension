package com.example.testfixture;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;

@Controller // Using @Controller instead of @RestController
public class LegacyController {

    @GetMapping("/legacy/data")
    @ResponseBody // Requires @ResponseBody on the method
    public String getLegacyData() {
        return "Some legacy data string.";
    }

    // This method might return a view name if @ResponseBody wasn't present
    @GetMapping("/legacy/page")
    public String getLegacyPage() {
        // In a real app, this might resolve to WEB-INF/views/legacy-page.jsp or similar
        return "legacy-page";
    }
}