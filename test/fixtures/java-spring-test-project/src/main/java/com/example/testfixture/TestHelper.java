package com.example.testfixture;

import java.util.Random;

public class TestHelper {

    private Random random = new Random();

    // Method with if-else logic
    public String getStatusMessage(boolean isActive, int level) {
        if (isActive) {
            if (level > 5) {
                return "System is active and highly operational.";
            } else if (level > 0) {
                return "System is active and operational.";
            } else {
                return "System is active but at a nominal level.";
            }
        } else {
            return "System is not active.";
        }
    }

    // Method with multiple conditions and potential early exit
    public TestModel processModel(TestModel model, String operation) {
        if (model == null) {
            return null; // Early exit if model is null
        }

        if (!model.isActive()) {
            // If model is not active, maybe log or do minimal processing
            System.out.println("Skipping processing for inactive model: " + model.getId());
            return model; // Return as is
        }

        // Simulate some processing based on operation
        if ("UPDATE_VALUE".equals(operation)) {
            int currentValue = model.getValue();
            model.setValue(currentValue + random.nextInt(100)); // Add a random value
        } else if ("CHANGE_NAME".equals(operation)) {
            model.setName(model.getName().toUpperCase() + "_PROCESSED");
        } else if ("TOGGLE_ACTIVITY".equals(operation)) {
            model.setActive(!model.isActive());
        } else {
            // Default case or unknown operation
            System.out.println("Unknown operation: " + operation + " for model: " + model.getId());
            // Potentially throw an exception or handle as an error
        }
        return model;
    }

    // Private helper method that might be called by public methods
    private String generateInternalCode(String base) {
        int randomNumber = random.nextInt(1000);
        if (base == null || base.isEmpty()) {
            return "DEFAULT_" + randomNumber;
        } else {
            return base.toUpperCase() + "_" + randomNumber;
        }
    }

    public String getComplexCode(String type) {
        if ("URGENT".equals(type)) {
            return generateInternalCode("URGENT_CODE");
        } else if ("NORMAL".equals(type)){
            return generateInternalCode("NORMAL_CODE");
        } else {
            return generateInternalCode(null); // Use default
        }
    }
}