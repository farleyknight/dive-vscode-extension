package com.example.testfixture;

import org.springframework.stereotype.Service;
import java.util.ArrayList;
import java.util.List;

@Service // Optional: for consistency if we want Spring to manage it, though not strictly needed for direct instantiation in this test
public class TestService {

    private TestHelper testHelper = new TestHelper(); // Instantiate TestHelper

    public String getServiceData() {
        return "Data from TestService";
    }

    public int getListSize() {
        // Example of a call to a standard Java library
        java.util.ArrayList<String> list = new java.util.ArrayList<>();
        list.add("item1");
        return list.size(); // This call to list.size() should appear in hierarchy
    }

    // New method using TestModel and TestHelper with conditional logic
    public TestModel processDataWithHelper(String id, String name, int initialValue, boolean isActive, String operationType, int statusLevel) {
        TestModel model = new TestModel(id, name, initialValue, isActive);

        // Use TestHelper to get a status message
        String statusMessage = testHelper.getStatusMessage(model.isActive(), statusLevel);
        System.out.println("Initial Status: " + statusMessage);

        if ("CRITICAL_PROCESS".equals(operationType) && model.isActive()) {
            // If critical and active, perform a series of operations
            model = testHelper.processModel(model, "UPDATE_VALUE");
            model = testHelper.processModel(model, "CHANGE_NAME");
            System.out.println("Performed critical processing.");
        } else if ("STANDARD_PROCESS".equals(operationType)) {
            // Standard processing, might depend on value
            if (model.getValue() > 100) {
                model = testHelper.processModel(model, "TOGGLE_ACTIVITY");
                System.out.println("Standard processing: toggled activity due to high value.");
            } else {
                model = testHelper.processModel(model, "UPDATE_VALUE");
                System.out.println("Standard processing: updated value.");
            }
        } else {
            System.out.println("No specific processing path taken for operation: " + operationType);
        }

        // Another call to helper for a final code
        String internalCode = testHelper.getComplexCode(model.isActive() ? "ACTIVE_MODEL" : "INACTIVE_MODEL");
        System.out.println("Generated internal code for model: " + internalCode);

        // Simulate updating the model name based on its activity post-processing
        if(model.isActive()) {
            model.setName(model.getName() + "_ACTIVE_FINAL");
        } else {
            model.setName(model.getName() + "_INACTIVE_FINAL");
        }

        return model;
    }

    // Another method with more complex logic
    public List<TestModel> generateModels(int count, boolean makeActive) {
        List<TestModel> models = new ArrayList<>();
        if (count <= 0) {
            System.out.println("Cannot generate zero or negative models.");
            return models; // Return empty list
        }

        for (int i = 0; i < count; i++) {
            String id = "MODEL_" + i;
            String name = "SampleModel_" + System.currentTimeMillis(); // Ensure some uniqueness
            int value = i * 10;
            boolean currentActiveState = makeActive;

            // Complex conditional logic for creating each model
            if (i % 3 == 0) { // Every 3rd model
                value += 50;
                currentActiveState = !makeActive; // Flip activity
                name += "_SPECIAL";
            } else if (i % 2 == 0) { // Every 2nd model (that's not a 3rd model)
                value += 20;
                name += "_EVEN";
            } else {
                name += "_ODD";
            }

            TestModel newModel = new TestModel(id, name, value, currentActiveState);
            // Process it slightly with the helper
            testHelper.processModel(newModel, "UPDATE_VALUE");
            models.add(newModel);
        }
        return models;
    }
}