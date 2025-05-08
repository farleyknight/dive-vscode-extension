package com.example.testfixture;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/test")
public class TestController {

    private TestService testService = new TestService();
    private TestHelper testHelper = new TestHelper(); // Instantiate TestHelper directly or inject

    // Simple GET
    @GetMapping("/hello")
    public String sayHello() {
        return "Hello World!";
    }

    // GET with Path Variable
    @GetMapping("/users/{userId}")
    public String getUser(@PathVariable String userId) {
        return "User ID: " + userId;
    }

    // GET with Request Parameter
    @GetMapping("/search")
    public String searchItems(@RequestParam String query) {
        return "Search query: " + query;
    }

    // POST with Request Body
    @PostMapping("/items")
    public String createItem(@RequestBody String item) {
        return "Created item: " + item;
    }

    // Endpoint with multiple HTTP methods
    @RequestMapping("/multi")
    public String handleMultiMethod() {
        return "Handled multi-method request";
    }

    private String privateHelperHello() {
        return "Hello from private helper!";
    }

    @GetMapping("/fullcomplexhello")
    public String fullComplexHello() {
        String privateData = privateHelperHello();
        String serviceData = testService.getServiceData();
        int listSize = testService.getListSize(); // Now using this call
        return privateData + " | " + serviceData + " | List size: " + listSize;
    }

    // New endpoint using the enhanced TestService method
    @PostMapping("/process-model")
    public TestModel processAdvancedModel(@RequestBody Map<String, Object> payload) {
        // Extract parameters from payload - needs robust error handling in a real app
        String id = (String) payload.getOrDefault("id", "defaultId");
        String name = (String) payload.getOrDefault("name", "DefaultName");
        int initialValue = (Integer) payload.getOrDefault("initialValue", 0);
        boolean isActive = (Boolean) payload.getOrDefault("isActive", false);
        String operationType = (String) payload.getOrDefault("operationType", "STANDARD_PROCESS");
        int statusLevel = (Integer) payload.getOrDefault("statusLevel", 1);

        // Conditional logic within the controller before calling service
        if (name.contains("admin")) {
            // Potentially escalate status level or change operation type for admin users
            statusLevel = Math.max(statusLevel, 5); // Ensure admin gets high status level
            if ("STANDARD_PROCESS".equals(operationType)) {
                operationType = "CRITICAL_PROCESS"; // Upgrade to critical for admin
            }
            System.out.println("Admin user detected, adjusting parameters.");
        }

        TestModel resultModel = testService.processDataWithHelper(id, name, initialValue, isActive, operationType, statusLevel);

        // Further conditional logic based on the result from the service
        if (resultModel != null && !resultModel.isActive()) {
            System.out.println("Model processing resulted in an inactive model. Logging id: " + resultModel.getId());
            // Perhaps trigger some alert or specific action for inactive models
        }
        return resultModel;
    }

    // New endpoint using TestHelper directly and TestService
    @GetMapping("/status-report/{type}")
    public String getStatusReport(@PathVariable String type, @RequestParam(defaultValue = "3") int level) {
        String helperStatus = testHelper.getStatusMessage(true, level);
        String serviceBasedCode = testHelper.getComplexCode(type.toUpperCase());

        // Logic combining results
        String report;
        if (level > 4 && "URGENT".equalsIgnoreCase(type)) {
            report = "High alert! Helper says: " + helperStatus + ". Code: " + serviceBasedCode + ". Needs immediate attention!";
        } else {
            report = "System report. Helper status: " + helperStatus + ". Generated code: " + serviceBasedCode + ".";
        }
        return report;
    }

    // Endpoint to demonstrate generating a list of models
    @GetMapping("/generate-models")
    public List<TestModel> generateMultipleModels(@RequestParam(defaultValue = "5") int count,
                                                @RequestParam(defaultValue = "true") boolean activeState) {
        if (count > 20) {
            // Safety break for too many models in a test endpoint
            System.out.println("Requested too many models. Limiting to 20.");
            count = 20;
        }
        return testService.generateModels(count, activeState);
    }
}