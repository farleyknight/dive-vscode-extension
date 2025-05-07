package com.example.testfixture;

import org.springframework.stereotype.Service;

@Service // Optional: for consistency if we want Spring to manage it, though not strictly needed for direct instantiation in this test
public class TestService {

    public String getServiceData() {
        return "Data from TestService";
    }

    public int getListSize() {
        // Example of a call to a standard Java library
        java.util.ArrayList<String> list = new java.util.ArrayList<>();
        list.add("item1");
        return list.size(); // This call to list.size() should appear in hierarchy
    }
}