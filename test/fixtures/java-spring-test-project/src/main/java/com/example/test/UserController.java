package com.example.test;

import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * A simple controller for testing endpoint discovery.
 */
@RestController
@RequestMapping("/api/v1/users") // Class-level request mapping
public class UserController {

    /**
     * Get all users.
     * @return A list of users (dummy).
     */
    @GetMapping
    public List<String> getAllUsers() {
        return Collections.singletonList("User1");
    }

    /**
     * Get a specific user by ID.
     * @param userId The ID of the user.
     * @return User details (dummy).
     */
    @GetMapping("/{userId}")
    public Map<String, String> getUserById(@PathVariable String userId) {
        return Collections.singletonMap("user", userId);
    }

    /**
     * Create a new user.
     * @param userData User data from request body.
     * @return Confirmation message.
     */
    @PostMapping
    public Map<String, String> createUser(@RequestBody Map<String, Object> userData) {
        return Collections.singletonMap("status", "created");
    }

    // Example with different method but same path (less common but possible)
    @PutMapping("/{userId}")
    public Map<String, String> updateUser(@PathVariable String userId, @RequestBody Map<String, Object> userData) {
        return Collections.singletonMap("status", "updated");
    }

    @DeleteMapping("/{userId}")
    public Map<String, String> deleteUser(@PathVariable String userId) {
         return Collections.singletonMap("status", "deleted");
    }

    // Endpoint without class-level mapping prefix
    @GetMapping("/api/v1/status")
    public Map<String, String> getStatus() {
        return Collections.singletonMap("status", "ok");
    }
}