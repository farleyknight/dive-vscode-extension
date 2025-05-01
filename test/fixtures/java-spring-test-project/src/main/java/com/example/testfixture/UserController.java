package com.example.testfixture;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v2/users") // Class-level path prefix
public class UserController {

    // Basic POST mapping
    @PostMapping("/")
    public ResponseEntity<String> createUser(@RequestBody Map<String, String> user) {
        return ResponseEntity.ok("User created: " + user.getOrDefault("name", "unknown"));
    }

    // PUT mapping with path variable
    @PutMapping("/{userId}")
    public ResponseEntity<String> updateUser(@PathVariable String userId, @RequestBody Map<String, String> user) {
        return ResponseEntity.ok("User " + userId + " updated");
    }

    // DELETE mapping with path variable
    @DeleteMapping("/{userId}")
    public ResponseEntity<Void> deleteUser(@PathVariable String userId) {
        return ResponseEntity.noContent().build();
    }

    // PATCH mapping with path variable and request param
    @PatchMapping("/{userId}/status")
    public ResponseEntity<String> updateUserStatus(
            @PathVariable String userId,
            @RequestParam("active") boolean isActive) {
        return ResponseEntity.ok("User " + userId + " status set to: " + isActive);
    }

    // RequestMapping with specific method (GET) and multiple paths
    @RequestMapping(value = {"/{userId}/profile", "/{userId}/details"}, method = RequestMethod.GET)
    public ResponseEntity<String> getUserProfile(@PathVariable String userId) {
        return ResponseEntity.ok("Profile for user " + userId);
    }

    // RequestMapping without specific method (implicitly handles all)
    @RequestMapping("/search")
    public ResponseEntity<String> searchUsers(@RequestParam Map<String, String> queryParams) {
        return ResponseEntity.ok("Search results based on: " + queryParams.toString());
    }

    // Method without a mapping annotation - should be ignored by discovery
    public void helperMethod() {
        // This should not be discovered as an endpoint
    }

    // Example with consumes and produces
    @PostMapping(value = "/{userId}/data", consumes = "application/json", produces = "application/xml")
    public String processUserData(@PathVariable String userId, @RequestBody String data) {
        // In a real app, return XML
        return "<response>Processed data for user " + userId + "</response>";
    }
}