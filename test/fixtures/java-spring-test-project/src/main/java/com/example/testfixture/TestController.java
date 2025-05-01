package com.example.testfixture;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/test")
public class TestController {

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
}